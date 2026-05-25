package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyseStockService {

    private final SaisieStockRepository saisieStockRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final ProgrammeRepository programmeRepo;
    private final RegionRepository regionRepo;

    @Value("${stock.seuil.tension:1.0}")
    private double seuilTension;

    @Value("${stock.seuil.surveiller:2.0}")
    private double seuilSurveiller;

    @Value("${stock.seuil.surstock:4.0}")
    private double seuilSurstock;

    @Value("${stock.securite.mois:1.0}")
    private double securiteMois;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public AnalyseResultatDTO analyserStocks(Long periodeId, Long programmeId, Long regionId) {
        List<SaisieStock> saisies = saisieStockRepo.findSubmittedByPeriodeAndProgrammeAndRegion(periodeId, programmeId, regionId);

        AnalyseResultatDTO resultat = new AnalyseResultatDTO();
        resultat.setPeriodeId(periodeId);
        resultat.setProgrammeId(programmeId);
        resultat.setRegionId(regionId);

        periodeRepo.findById(periodeId).ifPresent(p -> {
            String libelle = p.getDateRas() != null
                ? p.getDateRas().format(DATE_FMT)
                : String.format("%02d/%d", p.getMois(), p.getAnnee());
            resultat.setPeriodeLibelle(libelle);
        });
        programmeRepo.findById(programmeId).ifPresent(p -> resultat.setProgrammeNom(p.getNom()));
        regionRepo.findById(regionId).ifPresent(r -> resultat.setRegionNom(r.getNom()));

        Map<Long, List<SaisieStock>> byProduit = saisies.stream()
                .collect(Collectors.groupingBy(s -> s.getProduit().getId()));

        List<AnalyseResultatDTO.AnalyseProduitDTO> produits = new ArrayList<>();
        int nbTension = 0, nbSurstock = 0, nbRupture = 0;

        for (Map.Entry<Long, List<SaisieStock>> entry : byProduit.entrySet()) {
            AnalyseResultatDTO.AnalyseProduitDTO produitDTO = new AnalyseResultatDTO.AnalyseProduitDTO();
            SaisieStock first = entry.getValue().get(0);
            produitDTO.setProduitId(first.getProduit().getId());
            produitDTO.setProduitCode(first.getProduit().getCode());
            produitDTO.setProduitNom(first.getProduit().getNom());
            produitDTO.setProduitUnite(first.getProduit().getUnite());

            List<AnalyseResultatDTO.StructureAnalyseDTO> enRupture = new ArrayList<>();
            List<AnalyseResultatDTO.StructureAnalyseDTO> enTension = new ArrayList<>();
            List<AnalyseResultatDTO.StructureAnalyseDTO> enSurstock = new ArrayList<>();

            // Pour le diagnostic : sites BIEN_STOCKE/SURVEILLER non éligibles et raison
            long nbExclusSansDate = 0;
            long nbExclusMsdOk    = 0;

            for (SaisieStock saisie : entry.getValue()) {
                String statut = calculerStatut(saisie);
                AnalyseResultatDTO.StructureAnalyseDTO structDTO = toStructureAnalyseDTO(saisie, statut);

                switch (statut) {
                    case "RUPTURE"       -> enRupture.add(structDTO);
                    case "TENSION"       -> enTension.add(structDTO);
                    case "SURSTOCK"      -> enSurstock.add(structDTO);
                    case "STOCK_DORMANT" -> enSurstock.add(structDTO);
                    // Condition B : BIEN_STOCKE/SURVEILLER avec risque de péremption → source éligible
                    case "BIEN_STOCKE", "SURVEILLER" -> {
                        if (hasRisquePeremption(saisie)) {
                            enSurstock.add(structDTO);
                        } else if (saisie.getExpireDate() == null) {
                            nbExclusSansDate++;
                        } else {
                            nbExclusMsdOk++;
                        }
                    }
                }
            }

            produitDTO.setStructuresEnRupture(enRupture);
            produitDTO.setStructuresEnTension(enTension);
            produitDTO.setStructuresEnSurstock(enSurstock);

            BigDecimal totalExcedent = enSurstock.stream()
                    .map(s -> s.getExcedent() != null ? s.getExcedent() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalBesoin = enRupture.stream()
                    .map(s -> s.getBesoin() != null ? s.getBesoin() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalBesoin = totalBesoin.add(enTension.stream()
                    .map(s -> s.getBesoin() != null ? s.getBesoin() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add));

            if (enSurstock.isEmpty()) {
                produitDTO.setPotentielRedistribution("AUCUN_SURSTOCK");
                produitDTO.setDiagnostiqueSource(construireDiagnostique(
                        entry.getValue().size(), nbExclusSansDate, nbExclusMsdOk,
                        enRupture.size(), enTension.size()));
            } else if (totalExcedent.compareTo(totalBesoin) >= 0) {
                produitDTO.setPotentielRedistribution("POSSIBLE");
            } else {
                produitDTO.setPotentielRedistribution("INSUFFISANT");
            }

            if (!enRupture.isEmpty()) nbRupture++;
            if (!enTension.isEmpty()) nbTension++;
            if (!enSurstock.isEmpty()) nbSurstock++;

            produits.add(produitDTO);
        }

        resultat.setProduits(produits);
        resultat.setNbProduitsEnTension(nbTension);
        resultat.setNbProduitsEnSurstock(nbSurstock);
        resultat.setNbProduitsEnRupture(nbRupture);
        return resultat;
    }

    public String calculerStatut(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) {
            return saisie.getStockDisponible().compareTo(BigDecimal.ZERO) == 0 ? "RUPTURE" : "STOCK_DORMANT";
        }
        BigDecimal msd = saisie.getMsd() != null ? saisie.getMsd()
                : saisie.getStockDisponible().divide(saisie.getCmm(), 2, RoundingMode.HALF_UP);

        if (msd.compareTo(BigDecimal.ZERO) == 0) return "RUPTURE";
        if (msd.compareTo(BigDecimal.valueOf(seuilTension)) < 0) return "TENSION";
        if (msd.compareTo(BigDecimal.valueOf(seuilSurveiller)) < 0) return "SURVEILLER";
        if (msd.compareTo(BigDecimal.valueOf(seuilSurstock)) <= 0) return "BIEN_STOCKE";
        return "SURSTOCK";
    }

    private String construireDiagnostique(int total, long sansDate, long msdOk, int ruptures, int tensions) {
        if (total == 0) return "Aucune saisie soumise pour ce produit dans la région.";
        StringBuilder sb = new StringBuilder();
        sb.append(total).append(" saisie(s) analysée(s) — ");
        if (ruptures + tensions == total) {
            sb.append("toutes en RUPTURE/TENSION (cibles uniquement, aucune source disponible).");
            return sb.toString();
        }
        sb.append(ruptures + tensions).append(" cible(s), ");
        long autresSource = total - ruptures - tensions;
        sb.append(autresSource).append(" site(s) avec stock :");
        if (sansDate > 0) sb.append(" ").append(sansDate)
                .append(" BIEN_STOCKE/SURVEILLER exclus (date de péremption non renseignée dans la saisie) ;");
        if (msdOk > 0) sb.append(" ").append(msdOk)
                .append(" BIEN_STOCKE/SURVEILLER exclus (MSD ≤ mois restants — pas de surplus voué à périmer) ;");
        long restants = autresSource - sansDate - msdOk;
        if (restants > 0) sb.append(" ").append(restants).append(" autre(s) statut non éligible(s) ;");
        return sb.toString().replaceAll(";$", ".");
    }

    private boolean hasRisquePeremption(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) return false;
        if (saisie.getExpireDate() == null || saisie.getMsd() == null) return false;
        double moisRestants = ChronoUnit.DAYS.between(LocalDate.now(), saisie.getExpireDate()) / 30.0;
        return moisRestants > 0 && saisie.getMsd().doubleValue() > moisRestants;
    }

    public BigDecimal calculerExcedent(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) {
            // STOCK_DORMANT : tout le stock est redistribuable (pas de seuil de sécurité applicable)
            return saisie.getStockDisponible().compareTo(BigDecimal.ZERO) > 0
                    ? saisie.getStockDisponible() : BigDecimal.ZERO;
        }
        BigDecimal stockSecurite = saisie.getCmm().multiply(BigDecimal.valueOf(securiteMois * 2));
        BigDecimal excedent = saisie.getStockDisponible().subtract(stockSecurite);
        return excedent.compareTo(BigDecimal.ZERO) > 0 ? excedent : BigDecimal.ZERO;
    }

    public BigDecimal calculerBesoin(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        BigDecimal cible = saisie.getCmm().multiply(BigDecimal.valueOf(2));
        BigDecimal besoin = cible.subtract(saisie.getStockDisponible());
        return besoin.compareTo(BigDecimal.ZERO) > 0 ? besoin : BigDecimal.ZERO;
    }

    private AnalyseResultatDTO.StructureAnalyseDTO toStructureAnalyseDTO(SaisieStock saisie, String statut) {
        AnalyseResultatDTO.StructureAnalyseDTO dto = new AnalyseResultatDTO.StructureAnalyseDTO();
        dto.setStructureId(saisie.getStructure().getId());
        dto.setStructureCode(saisie.getStructure().getCode());
        dto.setStructureNom(saisie.getStructure().getNom());
        dto.setMsd(saisie.getMsd());
        dto.setStockDisponible(saisie.getStockDisponible());
        dto.setCmm(saisie.getCmm());
        dto.setStatutStock(statut);
        dto.setBesoin(calculerBesoin(saisie));
        dto.setExcedent(calculerExcedent(saisie));
        dto.setExpireDateFefo(saisie.getExpireDate());
        dto.setAllocationsExistantes(BigDecimal.ZERO);
        return dto;
    }
}
