package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.request.PeriodeRequest;
import org.lhspla.redistribution.dto.response.PeriodeSaisieDTO;
import org.lhspla.redistribution.entity.EtatStock;
import org.lhspla.redistribution.entity.PeriodeSaisie;
import org.lhspla.redistribution.entity.PlanReattribution;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.EtatStockRepository;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.PlanReattributionRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.lhspla.redistribution.repository.StructureProgrammeRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PeriodeService {

    private final PeriodeSaisieRepository periodeRepo;
    private final RegionRepository regionRepo;
    private final UtilisateurRepository utilisateurRepo;
    private final StructureProgrammeRepository structureProgrammeRepo;
    private final PlanReattributionRepository planRepo;
    private final SaisieStockRepository saisieStockRepo;
    private final EtatStockRepository etatStockRepo;

    public PeriodeSaisieDTO createPeriode(PeriodeRequest req, Long regionId, String username) {
        int annee = req.getDateRas().getYear();
        int mois = req.getDateRas().getMonthValue();

        periodeRepo.findByRegionIdAndDateRas(regionId, req.getDateRas()).ifPresent(p -> {
            throw BusinessException.badRequest(
                    "Une période existe déjà pour la date " + req.getDateRas() + " dans cette région");
        });

        Region region = regionRepo.findById(regionId)
                .orElseThrow(() -> BusinessException.notFound("Région", regionId));
        Utilisateur creePar = utilisateurRepo.findByUsername(username).orElseThrow();

        PeriodeSaisie periode = new PeriodeSaisie();
        periode.setAnnee(annee);
        periode.setMois(mois);
        periode.setDateRas(req.getDateRas());
        periode.setStatut("OUVERTE");
        periode.setRegion(region);
        periode.setCreePar(creePar);

        log.info("Création période {}/{} pour région {} par {}", mois, annee, regionId, username);
        return toDTO(periodeRepo.save(periode));
    }

    @Transactional(readOnly = true)
    public List<PeriodeSaisieDTO> findByRegion(Long regionId) {
        return periodeRepo.findByRegionIdOrderByDateRasDesc(regionId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PeriodeSaisieDTO> findAll() {
        return periodeRepo.findAllByOrderByAnneeDescMoisDesc()
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public PeriodeSaisieDTO rouvrirPeriode(Long periodeId, Long regionId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));

        if (periode.getRegion() == null || !periode.getRegion().getId().equals(regionId)) {
            throw BusinessException.forbidden("Cette période n'appartient pas à votre région");
        }
        if (!"FERMEE".equals(periode.getStatut())) {
            throw BusinessException.badRequest("La période doit être FERMEE pour pouvoir être rouverte");
        }

        periode.setStatut("OUVERTE");
        log.info("Réouverture période {} pour région {}", periodeId, regionId);
        return toDTO(periodeRepo.save(periode));
    }

    public PeriodeSaisieDTO fermerPeriode(Long periodeId, Long regionId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));

        if (periode.getRegion() == null || !periode.getRegion().getId().equals(regionId)) {
            throw BusinessException.forbidden("Cette période n'appartient pas à votre région");
        }
        if (!"OUVERTE".equals(periode.getStatut())) {
            throw BusinessException.badRequest("La période doit être OUVERTE pour pouvoir être fermée");
        }

        periode.setStatut("FERMEE");
        log.info("Fermeture manuelle période {} pour région {}", periodeId, regionId);
        return toDTO(periodeRepo.save(periode));
    }

    public void verifierEtFermerAutomatiquement(Long periodeId, Long regionId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId).orElse(null);
        if (periode == null || !"OUVERTE".equals(periode.getStatut())) {
            return;
        }

        int nbProgrammesActifs = structureProgrammeRepo.findActiveProgrammesByRegion(regionId).size();
        if (nbProgrammesActifs <= 0) {
            return;
        }

        long nbProgrammesAvecPlan = periodeRepo.countProgrammesWithValidatedPlan(periodeId, regionId);

        if (nbProgrammesAvecPlan >= nbProgrammesActifs) {
            periode.setStatut("FERMEE");
            periodeRepo.save(periode);
            log.info("Fermeture automatique période {} — {}/{} programmes avec plan validé",
                    periodeId, nbProgrammesAvecPlan, nbProgrammesActifs);
        }
    }

    @Transactional
    public void deletePeriode(Long periodeId, Long regionId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
            .orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        // vérifier périmètre
        if (regionId != null && (periode.getRegion() == null || !periode.getRegion().getId().equals(regionId))) {
            throw BusinessException.forbidden("Cette période n'appartient pas à votre région");
        }
        // bloquer si plans non-BROUILLON
        List<PlanReattribution> plansActifs = planRepo.findByPeriodeIdAndStatutNot(periodeId, "BROUILLON");
        if (!plansActifs.isEmpty()) {
            throw BusinessException.badRequest("Impossible de supprimer : " + plansActifs.size() + " plan(s) actif(s) associé(s)");
        }
        // supprimer saisies orphelines (periode_id direct, sans etat)
        saisieStockRepo.deleteByPeriodeId(periodeId);
        // supprimer etats (cascade → saisies liées)
        List<EtatStock> etats = etatStockRepo.findAllByPeriodeId(periodeId);
        etatStockRepo.deleteAll(etats);
        // supprimer plans BROUILLON + lignes (cascade via FK lignes_plan → plans)
        List<PlanReattribution> brouillons = planRepo.findByPeriodeIdAndStatut(periodeId, "BROUILLON");
        planRepo.deleteAll(brouillons);
        // supprimer période
        periodeRepo.delete(periode);
        log.info("Période {} supprimée", periodeId);
    }

    // --- Mapper ---

    public PeriodeSaisieDTO toDTO(PeriodeSaisie p) {
        PeriodeSaisieDTO dto = new PeriodeSaisieDTO();
        dto.setId(p.getId());
        dto.setAnnee(p.getAnnee());
        dto.setMois(p.getMois());
        dto.setDateRas(p.getDateRas());
        dto.setStatut(p.getStatut());
        dto.setLibelle(p.getDateRas() != null ? p.getDateRas().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : String.format("%02d/%d", p.getMois(), p.getAnnee()));
        dto.setCreatedAt(p.getCreatedAt());
        if (p.getRegion() != null) {
            dto.setRegionId(p.getRegion().getId());
            dto.setRegionNom(p.getRegion().getNom());
        }
        return dto;
    }
}
