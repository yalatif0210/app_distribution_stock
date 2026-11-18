package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.AnalyseResultatDTO;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
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

    /** Seuil de sécurité appliqué si la région n'en a pas (valeur par défaut de la colonne). */
    public static final BigDecimal SEUIL_SECURITE_PAR_DEFAUT = new BigDecimal("2.0");

    private final SaisieStockRepository saisieStockRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final ProgrammeRepository programmeRepo;
    private final RegionRepository regionRepo;
    private final SeuilsStatutService seuilsStatut;

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
        Optional<Region> region = regionRepo.findById(regionId);
        region.ifPresent(r -> resultat.setRegionNom(r.getNom()));
        BigDecimal seuilSecurite = seuilSecurite(region.orElse(null));

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
            List<AnalyseResultatDTO.StructureAnalyseDTO> sources = new ArrayList<>();

            // Pour le diagnostic : sites avec stock mais sans rien à céder
            long nbSousSeuil = 0;

            for (SaisieStock saisie : entry.getValue()) {
                String statut = calculerStatut(saisie);
                AnalyseResultatDTO.StructureAnalyseDTO structDTO = toStructureAnalyseDTO(saisie, statut, seuilSecurite);
                boolean cible = "RUPTURE".equals(statut) || "TENSION".equals(statut);

                if ("RUPTURE".equals(statut)) enRupture.add(structDTO);
                if ("TENSION".equals(statut)) enTension.add(structDTO);

                // Source : tout site qui a quelque chose à céder. Une cible ne peut l'être
                // que pour la part de son lot qui périmera avant d'être consommée (double rôle).
                if (structDTO.getExcedent().signum() > 0) {
                    sources.add(structDTO);
                } else if (!cible) {
                    nbSousSeuil++;
                }
            }

            produitDTO.setStructuresEnRupture(enRupture);
            produitDTO.setStructuresEnTension(enTension);
            produitDTO.setStructuresEnSurstock(sources);

            BigDecimal totalExcedent = sources.stream()
                    .map(AnalyseResultatDTO.StructureAnalyseDTO::getExcedent)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalBesoin = enRupture.stream()
                    .map(s -> s.getBesoin() != null ? s.getBesoin() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalBesoin = totalBesoin.add(enTension.stream()
                    .map(s -> s.getBesoin() != null ? s.getBesoin() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add));

            if (sources.isEmpty()) {
                produitDTO.setPotentielRedistribution("AUCUN_SURSTOCK");
                produitDTO.setDiagnostiqueSource(construireDiagnostique(
                        entry.getValue().size(), nbSousSeuil, enRupture.size(), enTension.size(), seuilSecurite));
            } else if (totalExcedent.compareTo(totalBesoin) >= 0) {
                produitDTO.setPotentielRedistribution("POSSIBLE");
            } else {
                produitDTO.setPotentielRedistribution("INSUFFISANT");
            }

            if (!enRupture.isEmpty()) nbRupture++;
            if (!enTension.isEmpty()) nbTension++;
            if (!sources.isEmpty()) nbSurstock++;

            produits.add(produitDTO);
        }

        resultat.setProduits(produits);
        resultat.setNbProduitsEnTension(nbTension);
        resultat.setNbProduitsEnSurstock(nbSurstock);
        resultat.setNbProduitsEnRupture(nbRupture);
        return resultat;
    }

    /** Seuil de sécurité (en mois de stock) que toute source de la région doit conserver. */
    public static BigDecimal seuilSecurite(Region region) {
        return region != null && region.getSeuilStockSecuriteMsd() != null
                ? region.getSeuilStockSecuriteMsd() : SEUIL_SECURITE_PAR_DEFAUT;
    }

    public String calculerStatut(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) {
            return saisie.getStockDisponible().compareTo(BigDecimal.ZERO) == 0 ? "RUPTURE" : "STOCK_DORMANT";
        }
        return seuilsStatut.statut(msd(saisie));
    }

    private static BigDecimal msd(SaisieStock saisie) {
        return saisie.getMsd() != null ? saisie.getMsd()
                : saisie.getStockDisponible().divide(saisie.getCmm(), 2, RoundingMode.HALF_UP);
    }

    private String construireDiagnostique(int total, long sousSeuil, int ruptures, int tensions, BigDecimal seuil) {
        if (total == 0) return "Aucune saisie soumise pour ce produit dans la région.";
        StringBuilder sb = new StringBuilder();
        sb.append(total).append(" saisie(s) analysée(s) : ");
        if (ruptures + tensions == total) {
            sb.append("toutes en RUPTURE/TENSION (cibles uniquement, aucune source disponible).");
            return sb.toString();
        }
        sb.append(ruptures + tensions).append(" cible(s), ");
        sb.append(sousSeuil).append(" site(s) avec un MSD inférieur ou égal au seuil de sécurité régional (")
          .append(seuil.stripTrailingZeros().toPlainString())
          .append(" mois) et sans lot voué à périmer : rien à céder.");
        return sb.toString();
    }

    /** Mois restant avant la péremption du lot, ou null si la date est inconnue ou passée. */
    private static Double moisAvantPeremption(SaisieStock saisie) {
        if (saisie.getExpireDate() == null) return null;
        double mois = ChronoUnit.DAYS.between(LocalDate.now(), saisie.getExpireDate()) / 30.0;
        return mois > 0 ? mois : null;
    }

    /**
     * Part du lot qui périmera avant d'être consommée : stock − (mois restants × CMM).
     * Zéro si le site consommera tout son stock avant la péremption.
     */
    public BigDecimal surplusPerimable(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().signum() <= 0) return BigDecimal.ZERO;
        Double mois = moisAvantPeremption(saisie);
        if (mois == null) return BigDecimal.ZERO;
        BigDecimal consommable = saisie.getCmm().multiply(BigDecimal.valueOf(mois));
        return saisie.getStockDisponible().subtract(consommable).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.DOWN);
    }

    /**
     * Quantité qu'un site peut céder, avant déduction des allocations déjà planifiées.
     * <ul>
     *   <li>stock dormant (aucune consommation) : tout le stock ;</li>
     *   <li>cas général : ce qui dépasse le seuil de sécurité régional, stock − seuil × CMM ;
     *       un site en rupture ou en tension ne cède rien à ce titre ;</li>
     *   <li>exception péremption : si le lot périmera avant d'être consommé, le site peut céder
     *       cette part même si elle le fait passer sous le seuil de sécurité.</li>
     * </ul>
     */
    public BigDecimal calculerExcedent(SaisieStock saisie, BigDecimal seuilSecurite) {
        BigDecimal stock = saisie.getStockDisponible();
        if (saisie.getCmm() == null || saisie.getCmm().signum() <= 0) {
            return stock.signum() > 0 ? stock : BigDecimal.ZERO;
        }
        return calculerExcedentHorsPeremption(saisie, seuilSecurite).max(surplusPerimable(saisie));
    }

    /** Vrai si la quantité cessible vient de l'exception péremption et non du seuil de sécurité. */
    public boolean cedeParExceptionPeremption(SaisieStock saisie, BigDecimal seuilSecurite) {
        if (saisie.getCmm() == null || saisie.getCmm().signum() <= 0) return false;
        BigDecimal perimable = surplusPerimable(saisie);
        return perimable.signum() > 0 && perimable.compareTo(calculerExcedentHorsPeremption(saisie, seuilSecurite)) > 0;
    }

    private BigDecimal calculerExcedentHorsPeremption(SaisieStock saisie, BigDecimal seuilSecurite) {
        String statut = calculerStatut(saisie);
        if ("RUPTURE".equals(statut) || "TENSION".equals(statut)) return BigDecimal.ZERO;
        return saisie.getStockDisponible().subtract(saisie.getCmm().multiply(seuilSecurite)).max(BigDecimal.ZERO);
    }

    /** Quantité pour amener la cible au seuil « à surveiller », c'est-à-dire hors tension. */
    public BigDecimal calculerBesoin(SaisieStock saisie) {
        if (saisie.getCmm() == null || saisie.getCmm().compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        BigDecimal cible = saisie.getCmm().multiply(seuilsStatut.seuils().surveiller());
        BigDecimal besoin = cible.subtract(saisie.getStockDisponible());
        return besoin.compareTo(BigDecimal.ZERO) > 0 ? besoin : BigDecimal.ZERO;
    }

    private AnalyseResultatDTO.StructureAnalyseDTO toStructureAnalyseDTO(SaisieStock saisie, String statut,
                                                                         BigDecimal seuilSecurite) {
        AnalyseResultatDTO.StructureAnalyseDTO dto = new AnalyseResultatDTO.StructureAnalyseDTO();
        dto.setStructureId(saisie.getStructure().getId());
        dto.setStructureCode(saisie.getStructure().getCode());
        dto.setStructureNom(saisie.getStructure().getNom());
        dto.setMsd(saisie.getMsd());
        dto.setStockDisponible(saisie.getStockDisponible());
        dto.setCmm(saisie.getCmm());
        dto.setStatutStock(statut);
        dto.setBesoin(calculerBesoin(saisie));
        dto.setExcedent(calculerExcedent(saisie, seuilSecurite));
        dto.setExceptionPeremption(cedeParExceptionPeremption(saisie, seuilSecurite));
        dto.setExpireDateFefo(saisie.getExpireDate());
        dto.setAllocationsExistantes(BigDecimal.ZERO);
        return dto;
    }
}
