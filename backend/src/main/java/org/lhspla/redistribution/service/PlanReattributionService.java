package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.request.LignePlanRequest;
import org.lhspla.redistribution.dto.request.ExecutionRequest;
import org.lhspla.redistribution.dto.request.PlanGenerationRequest;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.lhspla.redistribution.dto.response.LignePlanDTO;
import org.lhspla.redistribution.dto.response.PlanReattributionDTO;
import org.lhspla.redistribution.dto.response.StockSourceDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.lhspla.redistribution.dto.response.ExecutionProgressionDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PlanReattributionService {

    private final PlanReattributionRepository planRepo;
    private final LignePlanRepository ligneRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final ProgrammeRepository programmeRepo;
    private final RegionRepository regionRepo;
    private final StructureRepository structureRepo;
    private final ProduitRepository produitRepo;
    private final SaisieStockRepository saisieStockRepo;
    private final UtilisateurRepository utilisateurRepo;
    private final AnalyseStockService analyseStockService;
    private final MistralIaService mistralIaService;
    private final NotificationService notificationService;
    private final PeriodeService periodeService;

    public PlanReattributionDTO generer(PlanGenerationRequest req, String username) {
        PeriodeSaisie periode = periodeRepo.verrouiller(req.getPeriodeId())
                .orElseThrow(() -> BusinessException.notFound("Période", req.getPeriodeId()));
        Region region = regionRepo.findById(req.getRegionId())
                .orElseThrow(() -> BusinessException.notFound("Région", req.getRegionId()));

        if (planRepo.existsPlanActifFor(req.getPeriodeId(), req.getProgrammeId(), req.getRegionId())) {
            throw BusinessException.badRequest(
                "Un plan validé ou en cours d'exécution existe déjà pour cette période et ce programme. " +
                "Clôturez-le avant d'en générer un nouveau.");
        }

        // Un seul brouillon par périmètre : on le reprend, ou on le remplace explicitement.
        List<PlanReattribution> brouillons = planRepo.findBrouillons(
                req.getPeriodeId(), req.getProgrammeId(), req.getRegionId());
        if (!brouillons.isEmpty()) {
            if (!req.isRemplacerBrouillon()) {
                throw BusinessException.conflict(String.format(
                    "Un plan brouillon (n° %d) existe déjà pour cette période et ce programme. "
                    + "Reprenez-le ou demandez son remplacement.", brouillons.get(0).getId()));
            }
            log.info("Remplacement de {} brouillon(s) : {}", brouillons.size(),
                    brouillons.stream().map(PlanReattribution::getId).toList());
            planRepo.deleteAll(brouillons);
            planRepo.flush();
        }

        final AnalyseResultatDTO analyse;
        final Programme programme;

        if (req.getProgrammeId() == null) {
            // Mode multi-programmes : combiner toutes les analyses
            programme = null;
            List<Programme> tousLesProgrammes = programmeRepo.findByActiveTrue();
            if (tousLesProgrammes.isEmpty()) throw BusinessException.badRequest("Aucun programme actif");

            AnalyseResultatDTO combined = new AnalyseResultatDTO();
            combined.setPeriodeId(req.getPeriodeId());
            combined.setProgrammeId(null);
            combined.setRegionId(req.getRegionId());
            combined.setPeriodeLibelle(periode.getDateRas() != null
                ? periode.getDateRas().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                : String.format("%02d/%d", periode.getMois(), periode.getAnnee()));
            combined.setProgrammeNom("Tous les programmes");
            combined.setRegionNom(region.getNom());

            java.util.List<AnalyseResultatDTO.AnalyseProduitDTO> allProduits = new java.util.ArrayList<>();
            int nbTension = 0, nbSurstock = 0, nbRupture = 0;
            for (Programme prog : tousLesProgrammes) {
                AnalyseResultatDTO a = analyseStockService.analyserStocks(req.getPeriodeId(), prog.getId(), req.getRegionId());
                if (a.getProduits() != null) allProduits.addAll(a.getProduits());
                nbTension += a.getNbProduitsEnTension();
                nbSurstock += a.getNbProduitsEnSurstock();
                nbRupture += a.getNbProduitsEnRupture();
            }
            combined.setProduits(allProduits);
            combined.setNbProduitsEnTension(nbTension);
            combined.setNbProduitsEnSurstock(nbSurstock);
            combined.setNbProduitsEnRupture(nbRupture);
            analyse = combined;
        } else {
            programme = programmeRepo.findById(req.getProgrammeId())
                    .orElseThrow(() -> BusinessException.notFound("Programme", req.getProgrammeId()));
            analyse = analyseStockService.analyserStocks(req.getPeriodeId(), req.getProgrammeId(), req.getRegionId());
        }

        PlanReattribution plan = new PlanReattribution();
        plan.setPeriode(periode);
        plan.setProgramme(programme); // null si multi-programmes
        plan.setRegion(region);
        plan.setNotes(req.getNotes());
        plan.setGenereParlA(false);

        double seuil = region.getSeuilStockSecuriteMsd() != null
                ? region.getSeuilStockSecuriteMsd().doubleValue() : 2.0;

        // Répartition manuelle choisie : plan vide, construit ensuite produit par produit.
        // Analyse IA choisie mais non configurée ou sans réponse : le plan bascule en
        // répartition manuelle, et le motif est renvoyé pour prévenir le pharmacien.
        MistralIaService.PlanIaResponse iaResponse = null;
        String motifBascule = null;
        if (req.avecAnalyseIa() && analyse.getProduits() != null && !analyse.getProduits().isEmpty()) {
            if (!mistralIaService.estConfiguree()) {
                motifBascule = "L'analyse IA n'est pas configurée sur ce serveur.";
            } else {
                try {
                    iaResponse = mistralIaService.genererPlan(analyse, seuil);
                } catch (Exception e) {
                    log.warn("Mistral API indisponible : {}", e.getMessage());
                }
                if (iaResponse == null) {
                    motifBascule = "L'analyse IA n'a pas abouti (service injoignable ou réponse invalide).";
                }
            }
            if (motifBascule != null) log.info("Génération IA demandée, bascule en répartition manuelle : {}", motifBascule);
        }

        if (iaResponse != null) {
            plan.setGenereParlA(true);
            // Combiner résumé + avertissements éventuels dans resumeIa
            String resume = iaResponse.resume() != null ? iaResponse.resume().trim() : "";
            if (iaResponse.avertissements() != null && !iaResponse.avertissements().isEmpty()) {
                resume += (resume.isEmpty() ? "" : "\n\n")
                        + "⚠ " + String.join(" | ", iaResponse.avertissements());
            }
            plan.setResumeIa(resume.isBlank() ? null : sansTiretCadratin(resume));
            plan = planRepo.save(plan);

            for (MistralIaService.MouvementIA mv : iaResponse.mouvements()) {
                try {
                    ajouterLigneDepuisIA(plan, mv);
                } catch (Exception e) {
                    log.warn("Mouvement IA ignoré: {}", e.getMessage());
                }
            }
        } else {
            plan = planRepo.save(plan);
        }

        periodeService.verifierEtFermerAutomatiquement(req.getPeriodeId(), req.getRegionId());

        PlanReattributionDTO dto = toDTO(planRepo.findById(plan.getId()).orElseThrow(), true);
        if (motifBascule != null) {
            dto.setBasculeManuel(true);
            dto.setMotifBascule(motifBascule);
        }
        return dto;
    }

    @Transactional(readOnly = true)
    public List<PlanReattributionDTO> findAll(Long periodeId, String statut) {
        List<PlanReattribution> plans;
        if (periodeId != null && statut != null) {
            plans = planRepo.findByPeriodeIdAndStatut(periodeId, statut);
        } else if (periodeId != null) {
            plans = planRepo.findByPeriodeId(periodeId);
        } else if (statut != null) {
            plans = planRepo.findByStatut(statut);
        } else {
            plans = planRepo.findAllByOrderByCreatedAtDesc();
        }
        return plans.stream().map(p -> toDTO(p, false)).toList();
    }

    public boolean iaConfiguree() {
        return mistralIaService.estConfiguree();
    }

    /** Brouillon le plus récent du périmètre, s'il existe, pour proposer de le reprendre. */
    @Transactional(readOnly = true)
    public java.util.Optional<PlanReattributionDTO> brouillonExistant(Long periodeId, Long programmeId, Long regionId) {
        return planRepo.findBrouillons(periodeId, programmeId, regionId).stream()
                .findFirst().map(p -> toDTO(p, true));
    }

    @Transactional(readOnly = true)
    public PlanReattributionDTO findById(Long id) {
        return planRepo.findById(id)
                .map(p -> toDTO(p, true))
                .orElseThrow(() -> BusinessException.notFound("Plan", id));
    }

    public PlanReattributionDTO valider(Long id, String username) {
        PlanReattribution dejaValide = planRepo.verrouiller(id)
                .orElseThrow(() -> BusinessException.notFound("Plan", id));
        if ("VALIDE".equals(dejaValide.getStatut()) || "EN_COURS".equals(dejaValide.getStatut())) {
            return toDTO(dejaValide, true);
        }
        PlanReattribution plan = getPlanModifiable(id);
        if (plan.getLignes() == null || plan.getLignes().isEmpty()) {
            throw BusinessException.badRequest("Impossible de valider un plan sans lignes");
        }
        Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
        plan.setStatut("VALIDE");
        plan.setValidePar(user);
        plan.setDateValidation(LocalDateTime.now());
        notificationService.notifierValidation(planRepo.save(plan));
        return toDTO(plan, true);
    }

    public LignePlanDTO ajouterLigne(Long planId, LignePlanRequest req) {
        planRepo.verrouiller(planId);
        PlanReattribution plan = getPlanModifiable(planId);
        verifierStructuresDansRegionDuPlan(plan, req);
        validateCibleEnTension(plan, req);
        if (!ligneRepo.findMouvement(planId, req.getProduitId(), req.getStructureSourceId(), req.getStructureCibleId()).isEmpty()) {
            throw BusinessException.conflict(
                "Ce mouvement (même produit, même source, même cible) existe déjà dans le plan : modifiez sa quantité.");
        }
        StockSourceDTO stockInfo = calculerStockSource(
                plan.getPeriode().getId(), req.getProduitId(), req.getStructureSourceId(), planId, -1L);
        verifierQuantiteCessible(req.getQuantiteProposee(), stockInfo);
        LignePlan ligne = buildLigne(plan, req);
        ligne.setExpireDate(stockInfo.getExpireDateFefo());
        return toLigneDTO(ligneRepo.save(ligne));
    }

    public LignePlanDTO modifierLigne(Long planId, Long ligneId, LignePlanRequest req) {
        planRepo.verrouiller(planId);
        PlanReattribution plan = getPlanModifiable(planId);
        LignePlan ligne = ligneDuPlan(planId, ligneId);
        verifierStructuresDansRegionDuPlan(plan, req);
        validateCibleEnTension(plan, req);
        if (ligneRepo.findMouvement(planId, req.getProduitId(), req.getStructureSourceId(), req.getStructureCibleId())
                .stream().anyMatch(l -> !l.getId().equals(ligneId))) {
            throw BusinessException.conflict(
                "Ce mouvement (même produit, même source, même cible) existe déjà dans le plan.");
        }
        StockSourceDTO stockInfo = calculerStockSource(
                plan.getPeriode().getId(), req.getProduitId(), req.getStructureSourceId(), planId, ligneId);
        verifierQuantiteCessible(req.getQuantiteProposee(), stockInfo);
        Produit produit = produitRepo.findById(req.getProduitId())
                .orElseThrow(() -> BusinessException.notFound("Produit", req.getProduitId()));
        Structure source = structureRepo.findById(req.getStructureSourceId())
                .orElseThrow(() -> BusinessException.notFound("Structure source", req.getStructureSourceId()));
        Structure cible = structureRepo.findById(req.getStructureCibleId())
                .orElseThrow(() -> BusinessException.notFound("Structure cible", req.getStructureCibleId()));
        ligne.setProduit(produit);
        ligne.setStructureSource(source);
        ligne.setStructureCible(cible);
        ligne.setQuantiteProposee(req.getQuantiteProposee());
        ligne.setNotes(req.getNotes());
        ligne.setExpireDate(stockInfo.getExpireDateFefo());
        return toLigneDTO(ligneRepo.save(ligne));
    }

    public void supprimerPlan(Long id, String username) {
        PlanReattribution plan = planRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Plan", id));
        if (!"BROUILLON".equals(plan.getStatut())) {
            Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
            if (!"ADMIN".equals(user.getRole().getName())) {
                throw BusinessException.badRequest(
                    "Seul un administrateur peut supprimer un plan déjà validé");
            }
        }
        planRepo.delete(plan);
    }

    public void supprimerLigne(Long planId, Long ligneId, String username) {
        PlanReattribution plan = planRepo.verrouiller(planId)
                .orElseThrow(() -> BusinessException.notFound("Plan", planId));
        if ("CLOTURE".equals(plan.getStatut())) {
            throw BusinessException.badRequest("Le plan est clôturé, suppression impossible");
        }
        if (!"BROUILLON".equals(plan.getStatut())) {
            Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
            String roleName = user.getRole().getName();
            if (!"ADMIN".equals(roleName)) {
                throw BusinessException.badRequest(
                    "Seul un administrateur peut supprimer une ligne d'un plan validé");
            }
        }
        ligneRepo.delete(ligneDuPlan(planId, ligneId));
        verifierCloturePlan(plan);
    }

    public LignePlanDTO executerLigne(Long planId, Long ligneId, ExecutionRequest req) {
        PlanReattribution plan = planRepo.verrouiller(planId)
                .orElseThrow(() -> BusinessException.notFound("Plan", planId));
        if ("BROUILLON".equals(plan.getStatut())) {
            throw BusinessException.badRequest("Le plan doit être validé avant d'enregistrer des exécutions");
        }

        LignePlan ligne = ligneDuPlan(planId, ligneId);

        ligne.setQuantiteExecutee(req.getQuantiteExecutee());
        ligne.setNotes(req.getNotes());
        ligne.setDateExecution(LocalDateTime.now());

        int cmp = req.getQuantiteExecutee().compareTo(ligne.getQuantiteProposee());
        if (cmp >= 0) {
            ligne.setStatut("EXECUTE");
        } else if (req.getQuantiteExecutee().compareTo(BigDecimal.ZERO) > 0) {
            ligne.setStatut("PARTIEL");
        }

        ligneRepo.save(ligne);
        verifierCloturePlan(plan);
        return toLigneDTO(ligne);
    }

    private void verifierCloturePlan(PlanReattribution plan) {
        List<LignePlan> lignes = ligneRepo.findByPlanId(plan.getId());
        boolean toutTermine = lignes.stream()
                .allMatch(l -> "EXECUTE".equals(l.getStatut()) || "ANNULE".equals(l.getStatut()));
        if (toutTermine && !lignes.isEmpty()) {
            plan.setStatut("CLOTURE");
            plan.setDateCloture(LocalDateTime.now());
            planRepo.save(plan);
        }
    }

    /** Région d'un plan, pour le contrôle de périmètre. */
    @Transactional(readOnly = true)
    public Long regionDuPlan(Long planId) {
        PlanReattribution plan = planRepo.findById(planId)
                .orElseThrow(() -> BusinessException.notFound("Plan", planId));
        return plan.getRegion() != null ? plan.getRegion().getId() : null;
    }

    /** Une ligne n'est accessible qu'au travers de son propre plan. */
    private LignePlan ligneDuPlan(Long planId, Long ligneId) {
        LignePlan ligne = ligneRepo.findById(ligneId)
                .orElseThrow(() -> BusinessException.notFound("Ligne", ligneId));
        if (ligne.getPlan() == null || !planId.equals(ligne.getPlan().getId())) {
            throw BusinessException.notFound("Ligne", ligneId);
        }
        return ligne;
    }

    /** Source et cible d'une ligne doivent être des sites de la région du plan. */
    private void verifierStructuresDansRegionDuPlan(PlanReattribution plan, LignePlanRequest req) {
        Long regionPlan = plan.getRegion() != null ? plan.getRegion().getId() : null;
        for (Long structureId : java.util.Arrays.asList(req.getStructureSourceId(), req.getStructureCibleId())) {
            if (structureId == null) continue;
            Structure s = structureRepo.findById(structureId)
                    .orElseThrow(() -> BusinessException.notFound("Structure", structureId));
            Long regionStructure = s.getDistrict() != null && s.getDistrict().getRegion() != null
                    ? s.getDistrict().getRegion().getId() : null;
            if (regionPlan == null || !regionPlan.equals(regionStructure)) {
                throw BusinessException.badRequest(
                        "La structure « " + s.getNom() + " » n'appartient pas à la région du plan");
            }
        }
    }

    private PlanReattribution getPlanModifiable(Long id) {
        PlanReattribution plan = planRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Plan", id));
        if ("CLOTURE".equals(plan.getStatut())) {
            throw BusinessException.badRequest("Le plan est clôturé, modification impossible");
        }
        if ("VALIDE".equals(plan.getStatut()) || "EN_COURS".equals(plan.getStatut())) {
            throw BusinessException.badRequest("Le plan est validé, modification impossible");
        }
        return plan;
    }

    private LignePlan buildLigne(PlanReattribution plan, LignePlanRequest req) {
        Produit produit = produitRepo.findById(req.getProduitId())
                .orElseThrow(() -> BusinessException.notFound("Produit", req.getProduitId()));
        Structure source = structureRepo.findById(req.getStructureSourceId())
                .orElseThrow(() -> BusinessException.notFound("Structure source", req.getStructureSourceId()));
        Structure cible = structureRepo.findById(req.getStructureCibleId())
                .orElseThrow(() -> BusinessException.notFound("Structure cible", req.getStructureCibleId()));
        LignePlan ligne = new LignePlan();
        ligne.setPlan(plan);
        ligne.setProduit(produit);
        ligne.setStructureSource(source);
        ligne.setStructureCible(cible);
        ligne.setQuantiteProposee(req.getQuantiteProposee());
        ligne.setNotes(req.getNotes());
        return ligne;
    }

    private void ajouterLigneDepuisIA(PlanReattribution plan, MistralIaService.MouvementIA mv) {
        if (mv.produit_id() == null || mv.source_id() == null || mv.cible_id() == null) {
            log.warn("Mouvement IA ignoré — IDs manquants: {}", mv);
            return;
        }
        Produit produit = produitRepo.findById(mv.produit_id())
                .orElseThrow(() -> new RuntimeException("Produit IA introuvable id=" + mv.produit_id()));
        Structure source = structureRepo.findById(mv.source_id())
                .orElseThrow(() -> new RuntimeException("Structure source IA introuvable id=" + mv.source_id()));
        Structure cible  = structureRepo.findById(mv.cible_id())
                .orElseThrow(() -> new RuntimeException("Structure cible IA introuvable id=" + mv.cible_id()));

        LignePlan ligne = new LignePlan();
        ligne.setPlan(plan);
        ligne.setProduit(produit);
        ligne.setStructureSource(source);
        ligne.setStructureCible(cible);
        // Le système, et non l'IA, a le dernier mot sur le seuil de sécurité de la source :
        // une quantité trop forte est ramenée à ce que la source peut céder.
        BigDecimal quantite = BigDecimal.valueOf(mv.quantite_allouee());
        String ajustement = "";
        try {
            StockSourceDTO stockInfo = calculerStockSource(
                    plan.getPeriode().getId(), produit.getId(), source.getId(), plan.getId(), -1L);
            if (quantite.compareTo(stockInfo.getQuantiteMaxCessible()) > 0) {
                log.info("Mouvement IA ramené de {} à {} (seuil de sécurité de la source {})",
                        quantite, stockInfo.getQuantiteMaxCessible(), source.getNom());
                quantite = stockInfo.getQuantiteMaxCessible().setScale(0, java.math.RoundingMode.DOWN);
                ajustement = " Quantité ramenée à " + quantite.toPlainString()
                        + " par le système pour respecter le seuil de sécurité de la source.";
            }
        } catch (BusinessException e) {
            log.warn("Mouvement IA ignoré, pas de stock source : {}", e.getMessage());
            return;
        }
        if (quantite.signum() <= 0) {
            log.info("Mouvement IA ignoré : la source {} n'a rien à céder", source.getNom());
            return;
        }
        List<LignePlan> memeMouvement = ligneRepo.findMouvement(plan.getId(), produit.getId(), source.getId(), cible.getId());
        if (!memeMouvement.isEmpty()) {
            LignePlan existante = memeMouvement.get(0);
            log.info("Mouvement IA en double fusionné dans la ligne {} (+{})", existante.getId(), quantite);
            existante.setQuantiteProposee(existante.getQuantiteProposee().add(quantite));
            ligneRepo.save(existante);
            return;
        }
        ligne.setQuantiteProposee(quantite);
        // Motif IA stocké dans les notes de la ligne pour traçabilité
        String motif = mv.motif() != null ? sansTiretCadratin(mv.motif()).trim() : "";
        if (!(motif + ajustement).isBlank()) {
            ligne.setNotes((motif + ajustement).trim());
        }

        // R5 — date de péremption lue depuis la source, jamais depuis la réponse IA
        saisieStockRepo.findByPeriodeIdAndStructureIdAndProduitId(
                plan.getPeriode().getId(), source.getId(), produit.getId())
                .ifPresent(s -> ligne.setExpireDate(s.getExpireDate()));

        ligneRepo.save(ligne);
    }

    @Transactional(readOnly = true)
    public ExecutionProgressionDTO getProgressionAnnee(int annee, Set<Long> regionIds, Long programmeId) {
        // regionIds == null : toutes les régions (ADMIN)
        List<PlanReattribution> plans = planRepo.findForProgression(annee, null, programmeId).stream()
                .filter(p -> regionIds == null || (p.getRegion() != null && regionIds.contains(p.getRegion().getId())))
                .toList();

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM/yyyy");

        Map<Long, List<PlanReattribution>> byPeriode = plans.stream()
                .collect(Collectors.groupingBy(p -> p.getPeriode().getId()));

        List<ExecutionProgressionDTO.Item> items = byPeriode.entrySet().stream()
                .map(e -> {
                    var periode = e.getValue().get(0).getPeriode();
                    double avg = e.getValue().stream().mapToInt(p -> {
                        List<LignePlan> lignes = p.getLignes();
                        if (lignes == null || lignes.isEmpty()) return 0;
                        long exec = lignes.stream()
                                .filter(l -> "EXECUTE".equals(l.getStatut()) || "PARTIEL".equals(l.getStatut()))
                                .count();
                        return (int) (exec * 100 / lignes.size());
                    }).average().orElse(0.0);

                    ExecutionProgressionDTO.Item item = new ExecutionProgressionDTO.Item();
                    item.setPeriodeId(periode.getId());
                    item.setPeriodeLabel(periode.getDateRas() != null
                            ? periode.getDateRas().format(fmt)
                            : String.format("%02d/%d", periode.getMois(), periode.getAnnee()));
                    item.setProgressionMoyenne(Math.round(avg * 100.0) / 100.0);
                    item.setNbPlans(e.getValue().size());
                    return item;
                })
                .sorted(Comparator.comparingLong(ExecutionProgressionDTO.Item::getPeriodeId))
                .collect(Collectors.toList());

        ExecutionProgressionDTO result = new ExecutionProgressionDTO();
        result.setItems(items);
        return result;
    }

    // ─── Stock source — calcul net + FEFO ────────────────────────────────────────

    public StockSourceDTO calculerStockSource(Long periodeId, Long produitId,
            Long structureSourceId, Long planId, Long excludeLigneId) {
        SaisieStock saisie = saisieStockRepo
                .findByPeriodeIdAndStructureIdAndProduitId(periodeId, structureSourceId, produitId)
                .orElseThrow(() -> BusinessException.badRequest(
                    "Aucune donnée de stock pour la structure source sur ce produit dans cette période"));
        BigDecimal seuil = AnalyseStockService.seuilSecurite(
                planRepo.findById(planId).map(PlanReattribution::getRegion).orElse(null));
        BigDecimal stockBrut    = saisie.getStockDisponible();
        BigDecimal allocations  = ligneRepo.sumAllocations(planId, structureSourceId, produitId,
                excludeLigneId != null ? excludeLigneId : -1L);
        if (allocations == null) allocations = BigDecimal.ZERO;
        BigDecimal stockNet     = stockBrut.subtract(allocations).max(BigDecimal.ZERO);
        BigDecimal cessible     = analyseStockService.calculerExcedent(saisie, seuil)
                .subtract(allocations).max(BigDecimal.ZERO).min(stockNet);
        StockSourceDTO dto = new StockSourceDTO();
        dto.setStockBrut(stockBrut);
        dto.setAllocationsExistantes(allocations);
        dto.setStockNet(stockNet);
        dto.setQuantiteMaxCessible(cessible);
        dto.setSeuilSecuriteMsd(seuil);
        dto.setExceptionPeremption(analyseStockService.cedeParExceptionPeremption(saisie, seuil));
        dto.setExpireDateFefo(saisie.getExpireDate());
        return dto;
    }

    /** Refuse une quantité qui ferait passer la source sous son seuil de sécurité (hors exception péremption). */
    private static void verifierQuantiteCessible(BigDecimal quantite, StockSourceDTO stockInfo) {
        if (quantite.compareTo(stockInfo.getQuantiteMaxCessible()) <= 0) return;
        String seuil = stockInfo.getSeuilSecuriteMsd().stripTrailingZeros().toPlainString();
        if (stockInfo.getQuantiteMaxCessible().signum() == 0) {
            throw BusinessException.badRequest(String.format(
                "Cette source n'a plus rien à céder sur ce produit : elle doit conserver au moins %s mois de stock "
                + "(seuil de sécurité de la région), allocations déjà prévues comprises.", seuil));
        }
        throw BusinessException.badRequest(String.format(
            "Quantité (%s) supérieure à ce que la source peut céder (%s) : elle doit conserver au moins "
            + "%s mois de stock (seuil de sécurité de la région)%s.",
            quantite.stripTrailingZeros().toPlainString(),
            stockInfo.getQuantiteMaxCessible().stripTrailingZeros().toPlainString(), seuil,
            stockInfo.isExceptionPeremption() ? ", sauf la part de son lot qui périmera avant d'être consommée" : ""));
    }

    private void validateCibleEnTension(PlanReattribution plan, LignePlanRequest req) {
        SaisieStock saisie = saisieStockRepo
                .findByPeriodeIdAndStructureIdAndProduitId(
                        plan.getPeriode().getId(), req.getStructureCibleId(), req.getProduitId())
                .orElseThrow(() -> BusinessException.badRequest(
                    "Aucune donnée de stock soumise pour la structure cible sur ce produit"));
        if (req.getStructureCibleId().equals(req.getStructureSourceId())) {
            throw BusinessException.badRequest("La structure source et la structure cible doivent être différentes.");
        }
        if (!List.of("TENSION", "RUPTURE").contains(saisie.getStatutStock())) {
            throw BusinessException.badRequest(String.format(
                "La structure cible n'est pas en tension ni en rupture (statut : %s). " +
                "Redistribution non justifiée.", saisie.getStatutStock()));
        }
    }

    // --- Mappers ---

    public PlanReattributionDTO toDTO(PlanReattribution p, boolean withLignes) {
        PlanReattributionDTO dto = new PlanReattributionDTO();
        dto.setId(p.getId());
        dto.setStatut(p.getStatut());
        dto.setGenereParlA(p.getGenereParlA());
        dto.setResumeIa(p.getResumeIa());
        dto.setDateGeneration(p.getDateGeneration());
        dto.setDateValidation(p.getDateValidation());
        dto.setDateCloture(p.getDateCloture());
        dto.setNotes(p.getNotes());
        if (p.getPeriode() != null) {
            dto.setPeriodeId(p.getPeriode().getId());
            dto.setPeriodeLibelle(p.getPeriode().getDateRas() != null ? p.getPeriode().getDateRas().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : String.format("%02d/%d", p.getPeriode().getMois(), p.getPeriode().getAnnee()));
        }
        if (p.getProgramme() != null) {
            dto.setProgrammeId(p.getProgramme().getId());
            dto.setProgrammeNom(p.getProgramme().getNom());
        } else {
            dto.setProgrammeNom("Tous les programmes");
        }
        if (p.getRegion() != null) {
            dto.setRegionId(p.getRegion().getId());
            dto.setRegionNom(p.getRegion().getNom());
        }
        if (p.getValidePar() != null) {
            dto.setValideParUsername(p.getValidePar().getUsername());
        }
        if (withLignes) {
            // Un plan tout juste créé n'a pas encore de collection chargée : liste vide, jamais null
            List<LignePlanDTO> lignes = p.getLignes() == null ? List.of()
                    : p.getLignes().stream().map(this::toLigneDTO).toList();
            dto.setLignes(lignes);
            dto.setNbLignes(lignes.size());
            long executees = lignes.stream().filter(l -> "EXECUTE".equals(l.getStatut())).count();
            dto.setNbLignesExecutees((int) executees);
            dto.setProgression(lignes.isEmpty() ? 0 : (int) (executees * 100 / lignes.size()));
        }
        return dto;
    }

    private LignePlanDTO toLigneDTO(LignePlan l) {
        LignePlanDTO dto = new LignePlanDTO();
        dto.setId(l.getId());
        dto.setStatut(l.getStatut());
        dto.setQuantiteProposee(l.getQuantiteProposee());
        dto.setQuantiteExecutee(l.getQuantiteExecutee());
        dto.setDateExecution(l.getDateExecution());
        dto.setNotes(l.getNotes());
        if (l.getProduit() != null) {
            dto.setProduitId(l.getProduit().getId());
            dto.setProduitCode(l.getProduit().getCode());
            dto.setProduitNom(l.getProduit().getNom());
            dto.setProduitUnite(l.getProduit().getUnite());
        }
        if (l.getStructureSource() != null) {
            dto.setStructureSourceId(l.getStructureSource().getId());
            dto.setStructureSourceNom(l.getStructureSource().getNom());
        }
        if (l.getStructureCible() != null) {
            dto.setStructureCibleId(l.getStructureCible().getId());
            dto.setStructureCibleNom(l.getStructureCible().getNom());
        }
        dto.setExpireDate(l.getExpireDate());
        if (l.getQuantiteProposee() != null && l.getQuantiteExecutee() != null
                && l.getQuantiteProposee().compareTo(BigDecimal.ZERO) > 0) {
            dto.setProgression(l.getQuantiteExecutee()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(l.getQuantiteProposee(), 0, java.math.RoundingMode.HALF_UP)
                    .intValue());
        }
        return dto;
    }

    /** Le texte de l'IA est affiché tel quel : on remplace ses tirets cadratins. */
    private static String sansTiretCadratin(String texte) {
        return texte.replace(" — ", ", ").replace("—", "-");
    }
}
