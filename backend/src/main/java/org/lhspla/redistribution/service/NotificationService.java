package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.NotificationDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.repository.NotificationRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepo;
    private final UtilisateurRepository utilisateurRepo;

    @Transactional(readOnly = true)
    public List<NotificationDTO> findByUtilisateur(Long utilisateurId) {
        return notificationRepo.findByDestinataireIdOrderByDateEnvoiDesc(utilisateurId)
                .stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public long countNonLues(Long utilisateurId) {
        return notificationRepo.countByDestinataireIdAndLuFalse(utilisateurId);
    }

    public void marquerLu(Long notifId) {
        notificationRepo.findById(notifId).ifPresent(n -> {
            n.setLu(true);
            notificationRepo.save(n);
        });
    }

    public void marquerToutLu(Long utilisateurId) {
        notificationRepo.findByDestinataireIdAndLuFalse(utilisateurId).forEach(n -> {
            n.setLu(true);
            notificationRepo.save(n);
        });
    }

    public void notifierValidation(PlanReattribution plan) {
        if (plan.getLignes() == null) return;
        plan.getLignes().forEach(ligne -> {
            if (ligne.getStructureSource() == null) return;
            utilisateurRepo.findByStructureId(ligne.getStructureSource().getId()).forEach(user ->
                    creerNotification(plan, ligne, user, "RAPPEL_EXECUTION",
                            "Le plan " + plan.getId() + " a été validé. Veuillez exécuter le transfert de "
                                    + quantite(ligne.getQuantiteProposee()) + " " + ligne.getProduit().getUnite()
                                    + " de " + ligne.getProduit().getNom()
                                    + " vers " + ligne.getStructureCible().getNom() + ".")
            );
            // Le site destinataire sait ce qu'il doit recevoir, et qu'il devra en confirmer la réception
            if (ligne.getStructureCible() == null) return;
            utilisateurRepo.findByStructureId(ligne.getStructureCible().getId()).forEach(user ->
                    creerNotification(plan, ligne, user, "RECEPTION_ATTENDUE",
                            "Le plan " + plan.getId() + " a été validé : " + ligne.getStructureSource().getNom()
                                    + " doit vous livrer " + quantite(ligne.getQuantiteProposee()) + " "
                                    + ligne.getProduit().getUnite() + " de " + ligne.getProduit().getNom()
                                    + ". À l'arrivée, confirmez la réception dans Suivi des plans.")
            );
        });
    }

    /** Le pharmacien de la région est prévenu de chaque réception confirmée, avec l'écart éventuel. */
    public void notifierReception(LignePlan ligne, ReceptionLigne reception, Utilisateur auteur) {
        PlanReattribution plan = ligne.getPlan();
        if (plan == null || plan.getRegion() == null) return;
        String unite = ligne.getProduit() != null ? " " + ligne.getProduit().getUnite() : "";
        StringBuilder m = new StringBuilder()
                .append(ligne.getStructureCible().getNom()).append(" a reçu ")
                .append(quantite(reception.getQuantite())).append(unite)
                .append(" de ").append(ligne.getProduit().getNom())
                .append(" (plan ").append(plan.getId()).append(") : ")
                .append(quantite(ligne.getQuantiteExecutee())).append(" sur ")
                .append(quantite(ligne.getQuantiteProposee())).append(" reçus.");
        if (reception.getMotifEcart() != null) {
            m.append(" Réception close avec un écart : ").append(libelleMotif(reception.getMotifEcart())).append(".");
        }
        utilisateurRepo.findActiveByRegionAndRole(plan.getRegion().getId(), "PHARMACIEN_REGION").stream()
                .filter(u -> !u.getId().equals(auteur.getId()))
                .forEach(u -> {
                    // Chaque réception est une information distincte : pas de dédoublonnage ici
                    Notification n = new Notification();
                    n.setPlan(plan);
                    n.setLignePlan(ligne);
                    n.setDestinataire(u);
                    n.setType("RECEPTION");
                    n.setMessage(m.toString());
                    notificationRepo.save(n);
                });
    }

    private static String libelleMotif(String motif) {
        return switch (motif) {
            case "CASSE" -> "casse";
            case "PEREMPTION" -> "péremption";
            case "MANQUANT" -> "manquant";
            default -> "autre";
        };
    }

    private static String quantite(java.math.BigDecimal q) {
        return q == null ? "0" : q.stripTrailingZeros().toPlainString();
    }

    public void creerRappel(PlanReattribution plan) {
        if (plan.getLignes() == null) return;
        plan.getLignes().stream()
                .filter(l -> "EN_ATTENTE".equals(l.getStatut()) || "PARTIEL".equals(l.getStatut()))
                .forEach(ligne -> {
                    if (ligne.getStructureSource() == null) return;
                    utilisateurRepo.findByStructureId(ligne.getStructureSource().getId()).forEach(user ->
                            creerNotification(plan, ligne, user, "RAPPEL_EXECUTION",
                                    "Rappel: transfert en attente (" + ligne.getProduit().getNom()
                                            + " vers " + ligne.getStructureCible().getNom() + ")")
                    );
                });
    }

    public void alerterLignesEnRetard(LignePlan ligne) {
        if (ligne.getStructureSource() == null) return;
        utilisateurRepo.findByStructureId(ligne.getStructureSource().getId()).forEach(user ->
                creerNotification(ligne.getPlan(), ligne, user, "ALERTE_RETARD",
                        "Alerte retard: transfert non exécuté depuis plus de 14 jours : "
                                + ligne.getProduit().getNom())
        );
    }

    private void creerNotification(PlanReattribution plan, LignePlan ligne, Utilisateur destinataire,
                                    String type, String message) {
        // Rappels et alertes planifiés : une seule notification non lue par ligne, type et personne
        if (ligne != null && ligne.getId() != null
                && notificationRepo.existsByDestinataireIdAndTypeAndLignePlanIdAndLuFalse(destinataire.getId(), type, ligne.getId())) {
            return;
        }
        Notification notif = new Notification();
        notif.setPlan(plan);
        notif.setLignePlan(ligne);
        notif.setDestinataire(destinataire);
        notif.setType(type);
        notif.setMessage(message);
        notificationRepo.save(notif);
    }

    private NotificationDTO toDTO(Notification n) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(n.getId());
        dto.setType(n.getType());
        dto.setMessage(n.getMessage());
        dto.setLu(n.getLu());
        dto.setDateEnvoi(n.getDateEnvoi());
        if (n.getPlan() != null) dto.setPlanId(n.getPlan().getId());
        if (n.getLignePlan() != null) dto.setLignePlanId(n.getLignePlan().getId());
        return dto;
    }
}
