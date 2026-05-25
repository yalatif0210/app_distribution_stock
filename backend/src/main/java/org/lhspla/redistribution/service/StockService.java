package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.request.LigneSaisieRequest;
import org.lhspla.redistribution.dto.request.SaisieStockRequest;
import org.lhspla.redistribution.dto.response.EtatStockDTO;
import org.lhspla.redistribution.dto.response.EtatStockSummaryDTO;
import org.lhspla.redistribution.dto.response.LigneSaisieDTO;
import org.lhspla.redistribution.dto.response.SaisieStockDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StockService {

    private final SaisieStockRepository saisieStockRepo;
    private final EtatStockRepository etatStockRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final StructureRepository structureRepo;
    private final ProduitRepository produitRepo;
    private final ProgrammeRepository programmeRepo;
    private final UtilisateurRepository utilisateurRepo;
    private final AnalyseStockService analyseStockService;
    private final StructureProgrammeProduitRepository sppRepo;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Value("${stock.securite.mois:1.0}")
    private double securiteMois;

    // ─── Workflow SUGGESTED / SUBMITTED ──────────────────────────────────────

    @Transactional(readOnly = true)
    public EtatStockDTO getEtat(Long periodeId, Long programmeId, Long structureId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        Programme programme = programmeRepo.findById(programmeId)
                .orElseThrow(() -> BusinessException.notFound("Programme", programmeId));
        Structure structure = structureRepo.findById(structureId)
                .orElseThrow(() -> BusinessException.notFound("Structure", structureId));

        EtatStock etat = etatStockRepo
                .findByPeriodeIdAndStructureIdAndProgrammeId(periodeId, structureId, programmeId)
                .orElse(null);

        Map<Long, SaisieStock> saisiesParProduit = etat != null
                ? saisieStockRepo.findByEtatId(etat.getId()).stream()
                        .collect(Collectors.toMap(s -> s.getProduit().getId(), s -> s))
                : Map.of();

        // UNION : produits de la sélection active + produits ayant des saisies enregistrées
        // (permet la lecture complète d'un état soumis même si la sélection a changé)
        Set<Long> produitIds = new HashSet<>(
            sppRepo.findActiveProduits(structureId, programmeId)
                   .stream().map(Produit::getId).collect(Collectors.toSet()));
        produitIds.addAll(saisiesParProduit.keySet());
        List<Produit> produits = new ArrayList<>(produitRepo.findAllById(produitIds));
        produits.sort(Comparator.comparing(Produit::getNom));

        List<LigneSaisieDTO> lignes = produits.stream().map(p -> {
            SaisieStock s = saisiesParProduit.get(p.getId());
            LigneSaisieDTO ligne = new LigneSaisieDTO();
            ligne.setProduitId(p.getId());
            ligne.setProduitCode(p.getCode());
            ligne.setProduitNom(p.getNom());
            ligne.setProduitUnite(p.getUnite());
            if (s != null) {
                ligne.setSaisieId(s.getId());
                ligne.setStockDisponible(s.getStockDisponible());
                ligne.setCmm(s.getCmm());
                ligne.setStockSecurite(s.getStockSecurite());
                ligne.setMsd(s.getMsd());
                ligne.setExpireDate(s.getExpireDate());
                ligne.setStatutStock(s.getStatutStock());
                ligne.setSaved(true);
                calculerRisquePeremption(ligne, s);
            } else {
                ligne.setSaved(false);
            }
            return ligne;
        }).toList();

        EtatStockDTO dto = new EtatStockDTO();
        if (etat != null) {
            dto.setId(etat.getId());
            dto.setStatut(etat.getStatut());
            dto.setDateCreation(etat.getDateCreation());
            dto.setDateSoumission(etat.getDateSoumission());
        } else {
            dto.setStatut("SUGGESTED");
        }
        dto.setPeriodeId(periodeId);
        dto.setPeriodeLibelle(periode.getDateRas().format(DATE_FMT));
        dto.setPeriodeRas(periode.getDateRas());
        dto.setStructureId(structureId);
        dto.setStructureNom(structure.getNom());
        dto.setStructureCode(structure.getCode());
        dto.setProgrammeId(programmeId);
        dto.setProgrammeNom(programme.getNom());
        dto.setLignes(lignes);
        return dto;
    }

    public EtatStockDTO getOrCreateEtat(Long periodeId, Long programmeId, Long structureId, String username) {
        Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        if ("FERMEE".equals(periode.getStatut())) {
            throw BusinessException.badRequest("La période est fermée");
        }
        Programme programme = programmeRepo.findById(programmeId)
                .orElseThrow(() -> BusinessException.notFound("Programme", programmeId));
        Structure structure = structureRepo.findById(structureId)
                .orElseThrow(() -> BusinessException.notFound("Structure", structureId));

        Optional<EtatStock> existing = etatStockRepo.findByPeriodeIdAndStructureIdAndProgrammeId(periodeId, structureId, programmeId);
        if (existing.isPresent()) {
            EtatStock e = existing.get();
            if ("SUBMITTED".equals(e.getStatut())) {
                String dateStr = e.getDateSoumission() != null
                        ? e.getDateSoumission().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm"))
                        : "date inconnue";
                throw BusinessException.badRequest(
                        "Un état de stock a déjà été soumis pour le programme « " + programme.getNom()
                        + " » et cette période (soumis le " + dateStr + "). La saisie est clôturée.");
            }
        } else {
            EtatStock e = new EtatStock();
            e.setPeriode(periode);
            e.setStructure(structure);
            e.setProgramme(programme);
            e.setStatut("SUGGESTED");
            e.setSaisiPar(user);
            etatStockRepo.save(e);
        }

        return getEtat(periodeId, programmeId, structureId);
    }

    public LigneSaisieDTO saveLigne(LigneSaisieRequest req, String username) {
        Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
        EtatStock etat = etatStockRepo.findById(req.getEtatId())
                .orElseThrow(() -> BusinessException.notFound("EtatStock", req.getEtatId()));

        if ("GESTIONNAIRE".equals(user.getRole().getName())) {
            Long myStructureId = user.getStructure() != null ? user.getStructure().getId() : null;
            Long etatStructureId = etat.getStructure() != null ? etat.getStructure().getId() : null;
            if (!java.util.Objects.equals(myStructureId, etatStructureId)) {
                throw BusinessException.badRequest(
                        "Accès refusé : vous ne pouvez saisir que pour votre propre structure.");
            }
        }

        if ("SUBMITTED".equals(etat.getStatut())) {
            throw BusinessException.badRequest("Cet état a été soumis — modification impossible");
        }

        Produit produit = produitRepo.findById(req.getProduitId())
                .orElseThrow(() -> BusinessException.notFound("Produit", req.getProduitId()));

        if (req.getStockDisponible() != null
                && req.getStockDisponible().compareTo(BigDecimal.ZERO) > 0
                && req.getExpireDate() == null) {
            throw BusinessException.badRequest(
                    "La date de péremption est obligatoire quand le stock disponible est > 0");
        }
        if (req.getExpireDate() != null && !req.getExpireDate().isAfter(LocalDate.now())) {
            throw BusinessException.badRequest(
                    "La date de péremption doit être postérieure à la date de saisie.");
        }

        SaisieStock saisie = saisieStockRepo
                .findByEtatIdAndProduitId(etat.getId(), produit.getId())
                .orElse(new SaisieStock());

        saisie.setEtat(etat);
        saisie.setPeriode(etat.getPeriode());
        saisie.setStructure(etat.getStructure());
        saisie.setProduit(produit);
        saisie.setIgnored(false);
        saisie.setSaisiPar(user);
        saisie.setSource("MANUEL");
        saisie.setStockDisponible(req.getStockDisponible() != null ? req.getStockDisponible() : BigDecimal.ZERO);
        saisie.setCmm(req.getCmm());
        saisie.setExpireDate(req.getExpireDate());
        calculerIndicateurs(saisie);

        saisie = saisieStockRepo.save(saisie);
        etat.setSaisiPar(user);
        etatStockRepo.save(etat);
        return toLigneDTO(saisie, produit);
    }

    public EtatStockDTO submitEtat(Long etatId, String username) {
        Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();
        EtatStock etat = etatStockRepo.findById(etatId)
                .orElseThrow(() -> BusinessException.notFound("EtatStock", etatId));
        if ("SUBMITTED".equals(etat.getStatut())) {
            throw BusinessException.badRequest("Déjà soumis");
        }
        etat.setStatut("SUBMITTED");
        etat.setSoumispar(user);
        etat.setDateSoumission(LocalDateTime.now());
        etatStockRepo.save(etat);
        return getEtat(etat.getPeriode().getId(), etat.getProgramme().getId(), etat.getStructure().getId());
    }

    public EtatStockDTO reopenEtat(Long etatId, String username) {
        EtatStock etat = etatStockRepo.findById(etatId)
                .orElseThrow(() -> BusinessException.notFound("EtatStock", etatId));
        etat.setStatut("SUGGESTED");
        etat.setDateSoumission(null);
        etat.setSoumispar(null);
        etatStockRepo.save(etat);
        return getEtat(etat.getPeriode().getId(), etat.getProgramme().getId(), etat.getStructure().getId());
    }

    // ─── Lecture (tableau de bord, analyse) ──────────────────────────────────

    @Transactional(readOnly = true)
    public List<SaisieStockDTO> findSaisies(Long periodeId, Long programmeId, Long structureId) {
        List<SaisieStock> list;
        if (structureId != null) {
            list = saisieStockRepo.findByStructureIdAndPeriodeId(structureId, periodeId);
            if (programmeId != null) {
                final Long progId = programmeId;
                list = list.stream()
                        .filter(s -> s.getProduit().getProgramme().getId().equals(progId))
                        .toList();
            }
        } else {
            list = programmeId != null
                    ? saisieStockRepo.findSubmittedByPeriodeIdAndProgrammeId(periodeId, programmeId)
                    : saisieStockRepo.findByPeriodeId(periodeId);
        }
        return list.stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public SaisieStockDTO findById(Long id) {
        return saisieStockRepo.findById(id)
                .map(this::toDTO)
                .orElseThrow(() -> BusinessException.notFound("SaisieStock", id));
    }

    // ─── Import Excel (gardé) ─────────────────────────────────────────────────

    public SaisieStockDTO saisir(SaisieStockRequest req, String username) {
        PeriodeSaisie periode = periodeRepo.findById(req.getPeriodeId())
                .orElseThrow(() -> BusinessException.notFound("Période", req.getPeriodeId()));
        if ("FERMEE".equals(periode.getStatut())) {
            throw BusinessException.badRequest("La période est fermée");
        }
        if (req.getStockDisponible() != null
                && req.getStockDisponible().compareTo(BigDecimal.ZERO) > 0
                && req.getExpireDate() == null) {
            throw BusinessException.badRequest("La date de péremption est obligatoire si le stock est > 0");
        }
        if (req.getExpireDate() != null && !req.getExpireDate().isAfter(LocalDate.now())) {
            throw BusinessException.badRequest(
                    "La date de péremption doit être postérieure à la date de saisie.");
        }
        Structure structure = structureRepo.findById(req.getStructureId())
                .orElseThrow(() -> BusinessException.notFound("Structure", req.getStructureId()));
        Produit produit = produitRepo.findById(req.getProduitId())
                .orElseThrow(() -> BusinessException.notFound("Produit", req.getProduitId()));
        Utilisateur user = utilisateurRepo.findByUsername(username).orElseThrow();

        Programme programme = produit.getProgramme();
        EtatStock etat = etatStockRepo
                .findByPeriodeIdAndStructureIdAndProgrammeId(req.getPeriodeId(), req.getStructureId(), programme.getId())
                .orElseGet(() -> {
                    EtatStock e = new EtatStock();
                    e.setPeriode(periode);
                    e.setStructure(structure);
                    e.setProgramme(programme);
                    e.setStatut("SUGGESTED");
                    e.setSaisiPar(user);
                    return etatStockRepo.save(e);
                });

        SaisieStock saisie = saisieStockRepo
                .findByPeriodeIdAndStructureIdAndProduitId(req.getPeriodeId(), req.getStructureId(), req.getProduitId())
                .orElse(new SaisieStock());

        saisie.setEtat(etat);
        saisie.setPeriode(periode);
        saisie.setStructure(structure);
        saisie.setProduit(produit);
        saisie.setStockDisponible(req.getStockDisponible());
        saisie.setCmm(req.getCmm());
        saisie.setExpireDate(req.getExpireDate());
        saisie.setSaisiPar(user);
        saisie.setSource("MANUEL");
        saisie.setIgnored(false);
        calculerIndicateurs(saisie);
        return toDTO(saisieStockRepo.save(saisie));
    }

    public SaisieStockDTO modifier(Long id, SaisieStockRequest req, String username) {
        SaisieStock saisie = saisieStockRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("SaisieStock", id));
        if (saisie.getEtat() != null && "SUBMITTED".equals(saisie.getEtat().getStatut())) {
            throw BusinessException.badRequest("État soumis — modification impossible");
        }
        saisie.setStockDisponible(req.getStockDisponible());
        saisie.setCmm(req.getCmm());
        saisie.setExpireDate(req.getExpireDate());
        calculerIndicateurs(saisie);
        return toDTO(saisieStockRepo.save(saisie));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void calculerIndicateurs(SaisieStock saisie) {
        if (saisie.getCmm() != null && saisie.getCmm().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal msd = saisie.getStockDisponible().divide(saisie.getCmm(), 2, RoundingMode.HALF_UP);
            saisie.setMsd(msd);
            saisie.setStockSecurite(saisie.getCmm().multiply(BigDecimal.valueOf(securiteMois)));
        } else {
            saisie.setMsd(BigDecimal.ZERO);
        }
        saisie.setStatutStock(analyseStockService.calculerStatut(saisie));
    }

    private LigneSaisieDTO toLigneDTO(SaisieStock s, Produit p) {
        LigneSaisieDTO dto = new LigneSaisieDTO();
        dto.setSaisieId(s.getId());
        dto.setProduitId(p.getId());
        dto.setProduitCode(p.getCode());
        dto.setProduitNom(p.getNom());
        dto.setProduitUnite(p.getUnite());
        dto.setStockDisponible(s.getStockDisponible());
        dto.setCmm(s.getCmm());
        dto.setStockSecurite(s.getStockSecurite());
        dto.setMsd(s.getMsd());
        dto.setExpireDate(s.getExpireDate());
        dto.setStatutStock(s.getStatutStock());
        dto.setSaved(true);
        calculerRisquePeremption(dto, s);
        return dto;
    }

    private void calculerRisquePeremption(LigneSaisieDTO dto, SaisieStock s) {
        if (s.getExpireDate() == null || s.getMsd() == null) return;
        LocalDate dateSaisie = s.getDateSaisie() != null
                ? s.getDateSaisie().toLocalDate()
                : LocalDate.now();
        double dureeRestante = ChronoUnit.DAYS.between(dateSaisie, s.getExpireDate()) / 30.0;
        double surplus = s.getMsd().doubleValue() - dureeRestante;
        if (surplus > 0) {
            dto.setRisquePeremption(true);
            dto.setSurplusMois(Math.round(surplus * 10.0) / 10.0);
        } else {
            dto.setRisquePeremption(false);
            dto.setSurplusMois(0.0);
        }
    }

    public SaisieStockDTO toDTO(SaisieStock s) {
        SaisieStockDTO dto = new SaisieStockDTO();
        dto.setId(s.getId());
        dto.setStockDisponible(s.getStockDisponible());
        dto.setCmm(s.getCmm());
        dto.setStockSecurite(s.getStockSecurite());
        dto.setMsd(s.getMsd());
        dto.setExpireDate(s.getExpireDate());
        dto.setStatutStock(s.getStatutStock());
        dto.setDateSaisie(s.getDateSaisie());
        dto.setSource(s.getSource());
        if (s.getPeriode() != null) {
            dto.setPeriodeId(s.getPeriode().getId());
            dto.setPeriodeLibelle(s.getPeriode().getDateRas().format(DATE_FMT));
        }
        if (s.getStructure() != null) {
            dto.setStructureId(s.getStructure().getId());
            dto.setStructureNom(s.getStructure().getNom());
            dto.setStructureCode(s.getStructure().getCode());
            if (s.getStructure().getDistrict() != null && s.getStructure().getDistrict().getRegion() != null) {
                dto.setStructureRegionId(s.getStructure().getDistrict().getRegion().getId());
            }
        }
        if (s.getProduit() != null) {
            dto.setProduitId(s.getProduit().getId());
            dto.setProduitNom(s.getProduit().getNom());
            dto.setProduitCode(s.getProduit().getCode());
            dto.setProduitUnite(s.getProduit().getUnite());
        }
        return dto;
    }

    @Transactional(readOnly = true)
    public List<EtatStockSummaryDTO> listEtats(Long periodeId, Long programmeId, Long regionId, Long structureId) {
        List<EtatStock> etats;
        if (structureId != null) {
            // GESTIONNAIRE : uniquement ses propres états
            etats = programmeId != null
                ? etatStockRepo.findByPeriodeAndStructureAndProgramme(periodeId, structureId, programmeId)
                : etatStockRepo.findByPeriodeIdAndStructureId(periodeId, structureId);
        } else if (regionId != null && programmeId != null) {
            etats = etatStockRepo.findByPeriodeAndProgrammeAndRegion(periodeId, programmeId, regionId);
        } else if (regionId != null) {
            etats = etatStockRepo.findByPeriodeId(periodeId).stream()
                .filter(e -> e.getStructure().getDistrict().getRegion().getId().equals(regionId))
                .toList();
        } else if (programmeId != null) {
            etats = etatStockRepo.findByPeriodeIdAndProgrammeId(periodeId, programmeId);
        } else {
            etats = etatStockRepo.findAllByPeriodeId(periodeId);
        }
        return etats.stream().map(this::toSummaryDTO).toList();
    }

    public void deleteEtat(Long etatId, String username) {
        EtatStock etat = etatStockRepo.findById(etatId)
            .orElseThrow(() -> BusinessException.notFound("EtatStock", etatId));
        // saisies_stock cascade via FK ON DELETE CASCADE
        etatStockRepo.delete(etat);
        log.info("EtatStock {} supprimé par {}", etatId, username);
    }

    private EtatStockSummaryDTO toSummaryDTO(EtatStock e) {
        EtatStockSummaryDTO dto = new EtatStockSummaryDTO();
        dto.setId(e.getId());
        if (e.getPeriode() != null) {
            dto.setPeriodeId(e.getPeriode().getId());
            dto.setPeriodeLibelle(e.getPeriode().getDateRas() != null
                ? e.getPeriode().getDateRas().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                : String.format("%02d/%d", e.getPeriode().getMois(), e.getPeriode().getAnnee()));
        }
        dto.setStructureId(e.getStructure().getId());
        dto.setStructureNom(e.getStructure().getNom());
        dto.setStructureCode(e.getStructure().getCode());
        dto.setStructureType(e.getStructure().getType());
        if (e.getProgramme() != null) {
            dto.setProgrammeId(e.getProgramme().getId());
            dto.setProgrammeNom(e.getProgramme().getNom());
        }
        dto.setStatut(e.getStatut());
        dto.setDateCreation(e.getDateCreation());
        dto.setDateSoumission(e.getDateSoumission());
        List<SaisieStock> lignes = saisieStockRepo.findByEtatId(e.getId());
        dto.setNbLignes(lignes.size());
        dto.setNbLignesSaved((int) lignes.stream().filter(l -> !Boolean.TRUE.equals(l.getIgnored())).count());
        dto.setNbLignesIgnored((int) lignes.stream().filter(l -> Boolean.TRUE.equals(l.getIgnored())).count());
        return dto;
    }
}
