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
                                    + ligne.getQuantiteProposee() + " " + ligne.getProduit().getUnite()
                                    + " de " + ligne.getProduit().getNom()
                                    + " vers " + ligne.getStructureCible().getNom())
            );
        });
    }

    public void creerRappel(PlanReattribution plan) {
        if (plan.getLignes() == null) return;
        plan.getLignes().stream()
                .filter(l -> "EN_ATTENTE".equals(l.getStatut()) || "PARTIEL".equals(l.getStatut()))
                .forEach(ligne -> {
                    if (ligne.getStructureSource() == null) return;
                    utilisateurRepo.findByStructureId(ligne.getStructureSource().getId()).forEach(user ->
                            creerNotification(plan, ligne, user, "RAPPEL_EXECUTION",
                                    "Rappel: transfert en attente — " + ligne.getProduit().getNom()
                                            + " vers " + ligne.getStructureCible().getNom())
                    );
                });
    }

    public void alerterLignesEnRetard(LignePlan ligne) {
        if (ligne.getStructureSource() == null) return;
        utilisateurRepo.findByStructureId(ligne.getStructureSource().getId()).forEach(user ->
                creerNotification(ligne.getPlan(), ligne, user, "ALERTE_RETARD",
                        "Alerte retard: transfert non exécuté depuis plus de 14 jours — "
                                + ligne.getProduit().getNom())
        );
    }

    private void creerNotification(PlanReattribution plan, LignePlan ligne, Utilisateur destinataire,
                                    String type, String message) {
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
