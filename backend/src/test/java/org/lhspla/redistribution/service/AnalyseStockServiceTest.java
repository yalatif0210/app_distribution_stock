package org.lhspla.redistribution.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.lhspla.redistribution.entity.ParametresStatut;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.repository.ParametresStatutRepository;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class AnalyseStockServiceTest {

    @Mock private SaisieStockRepository saisieStockRepo;
    @Mock private PeriodeSaisieRepository periodeRepo;
    @Mock private ProgrammeRepository programmeRepo;
    @Mock private RegionRepository regionRepo;
    @Mock private ParametresStatutRepository parametresStatutRepo;

    private AnalyseStockService service;

    private static final BigDecimal SEUIL_2 = new BigDecimal("2.0");

    @BeforeEach
    void injecterSeuils() {
        // Seuils de statut par défaut (migration V12) : 1 / 2 / 4 mois
        ParametresStatut p = new ParametresStatut();
        p.setSeuilTension(new BigDecimal("1.0"));
        p.setSeuilSurveiller(new BigDecimal("2.0"));
        p.setSeuilSurstock(new BigDecimal("4.0"));
        lenient().when(parametresStatutRepo.findById(ParametresStatut.ID_UNIQUE)).thenReturn(Optional.of(p));
        SeuilsStatutService seuils = new SeuilsStatutService(parametresStatutRepo, saisieStockRepo);
        service = new AnalyseStockService(saisieStockRepo, periodeRepo, programmeRepo, regionRepo, seuils);
    }

    // ── calculerStatut ───────────────────────────────────────────────────────────

    @Test
    void statut_RUPTURE_quand_msd_est_zero() {
        assertThat(service.calculerStatut(saisieAvecMsd("0.00"))).isEqualTo("RUPTURE");
    }

    @ParameterizedTest(name = "msd={0} → TENSION")
    @CsvSource({"0.01", "0.50", "0.99"})
    void statut_TENSION_entre_zero_exclu_et_seuil_tension(String msdStr) {
        assertThat(service.calculerStatut(saisieAvecMsd(msdStr))).isEqualTo("TENSION");
    }

    @ParameterizedTest(name = "msd={0} → SURVEILLER")
    @CsvSource({"1.00", "1.50", "1.99"})
    void statut_SURVEILLER_entre_tension_et_surveiller(String msdStr) {
        assertThat(service.calculerStatut(saisieAvecMsd(msdStr))).isEqualTo("SURVEILLER");
    }

    @ParameterizedTest(name = "msd={0} → BIEN_STOCKE")
    @CsvSource({"2.00", "3.00", "4.00"})
    void statut_BIEN_STOCKE_entre_surveiller_et_surstock_inclus(String msdStr) {
        assertThat(service.calculerStatut(saisieAvecMsd(msdStr))).isEqualTo("BIEN_STOCKE");
    }

    @ParameterizedTest(name = "msd={0} → SURSTOCK")
    @CsvSource({"4.01", "6.00", "12.00"})
    void statut_SURSTOCK_au_dessus_du_seuil(String msdStr) {
        assertThat(service.calculerStatut(saisieAvecMsd(msdStr))).isEqualTo("SURSTOCK");
    }

    @Test
    void statut_RUPTURE_quand_stock_zero_et_cmm_nulle() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(BigDecimal.ZERO);
        s.setCmm(null);
        assertThat(service.calculerStatut(s)).isEqualTo("RUPTURE");
    }

    @Test
    void statut_STOCK_DORMANT_quand_stock_positif_et_cmm_nulle() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("100"));
        s.setCmm(null);
        assertThat(service.calculerStatut(s)).isEqualTo("STOCK_DORMANT");
    }

    @Test
    void statut_STOCK_DORMANT_quand_stock_positif_et_cmm_zero() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("50"));
        s.setCmm(BigDecimal.ZERO);
        assertThat(service.calculerStatut(s)).isEqualTo("STOCK_DORMANT");
    }

    // ── calculerExcedent ─────────────────────────────────────────────────────────

    @Test
    void excedent_STOCK_DORMANT_retourne_stock_complet_quand_cmm_nulle() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("200"));
        s.setCmm(null);
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo("200");
    }

    @Test
    void excedent_STOCK_DORMANT_retourne_stock_complet_quand_cmm_zero() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("75"));
        s.setCmm(BigDecimal.ZERO);
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo("75");
    }

    @Test
    void excedent_zero_quand_stock_dormant_et_stock_nul() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(BigDecimal.ZERO);
        s.setCmm(null);
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void excedent_est_ce_qui_depasse_le_seuil_de_securite_regional() {
        // seuil 2 mois : le site garde 10 × 2 = 20, il peut céder 50 − 20 = 30
        SaisieStock s = saisieAvecStockEtCmm("50", "10");
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo("30");
    }

    @Test
    void site_bien_stocke_au_dessus_du_seuil_est_source() {
        // MSD 3 (BIEN_STOCKE, pas SURSTOCK) avec un seuil régional de 2 : il cède 1 mois
        SaisieStock s = saisieAvecStockEtCmm("30", "10");
        assertThat(service.calculerStatut(s)).isEqualTo("BIEN_STOCKE");
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo("10");
    }

    @Test
    void le_seuil_de_la_region_change_la_quantite_cessible() {
        SaisieStock s = saisieAvecStockEtCmm("30", "10");
        assertThat(service.calculerExcedent(s, new BigDecimal("2.5"))).isEqualByComparingTo("5");
        assertThat(service.calculerExcedent(s, new BigDecimal("3.0"))).isEqualByComparingTo("0");
    }

    @Test
    void excedent_zero_quand_stock_inferieur_au_seuil_de_securite() {
        SaisieStock s = saisieAvecStockEtCmm("15", "10");
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void site_en_tension_ne_cede_rien_meme_au_dessus_d_un_seuil_bas() {
        // MSD 0,8 (TENSION) avec un seuil de 0,5 : une cible ne cède pas son stock
        SaisieStock s = saisieAvecStockEtCmm("8", "10");
        assertThat(service.calculerExcedent(s, new BigDecimal("0.5"))).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ── Exception péremption ─────────────────────────────────────────────────────

    @Test
    void peremption_permet_de_descendre_sous_le_seuil() {
        // 30 en stock, 10 consommés par mois, lot périmé dans 60 jours (2 mois) :
        // 10 unités périmeront. Au-dessus du seuil de 2,5 il n'y aurait que 5 à céder.
        SaisieStock s = saisieAvecStockEtCmm("30", "10");
        s.setExpireDate(LocalDate.now().plusDays(60));
        BigDecimal seuil = new BigDecimal("2.5");
        assertThat(service.calculerExcedent(s, seuil)).isEqualByComparingTo("10");
        assertThat(service.cedeParExceptionPeremption(s, seuil)).isTrue();
    }

    @Test
    void peremption_ne_s_applique_pas_si_le_seuil_laisse_ceder_davantage() {
        SaisieStock s = saisieAvecStockEtCmm("30", "10");
        s.setExpireDate(LocalDate.now().plusDays(60));
        assertThat(service.calculerExcedent(s, new BigDecimal("1.0"))).isEqualByComparingTo("20");
        assertThat(service.cedeParExceptionPeremption(s, new BigDecimal("1.0"))).isFalse();
    }

    @Test
    void site_en_tension_cede_seulement_sa_part_perimable() {
        // MSD 0,9 (TENSION), lot périmé dans 15 jours : 9 − 10 × 0,5 = 4 unités périmeront
        SaisieStock s = saisieAvecStockEtCmm("9", "10");
        s.setExpireDate(LocalDate.now().plusDays(15));
        assertThat(service.calculerExcedent(s, SEUIL_2)).isEqualByComparingTo("4");
    }

    // ── calculerBesoin ───────────────────────────────────────────────────────────

    @Test
    void besoin_zero_quand_cmm_nulle() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("5"));
        s.setCmm(null);
        assertThat(service.calculerBesoin(s)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void besoin_positif_quand_stock_inferieur_a_cible() {
        // cible = cmm * 2 = 10 * 2 = 20
        // besoin = 20 - 5 = 15
        SaisieStock s = saisieAvecStockEtCmm("5", "10");
        assertThat(service.calculerBesoin(s)).isEqualByComparingTo("15");
    }

    @Test
    void besoin_zero_quand_stock_superieur_ou_egal_a_cible() {
        // cible = 10 * 2 = 20 ; stock = 25 > cible → besoin = 0
        SaisieStock s = saisieAvecStockEtCmm("25", "10");
        assertThat(service.calculerBesoin(s)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private SaisieStock saisieAvecMsd(String msd) {
        SaisieStock s = new SaisieStock();
        s.setMsd(new BigDecimal(msd));
        s.setCmm(new BigDecimal("10.00"));
        s.setStockDisponible(new BigDecimal(msd).multiply(new BigDecimal("10.00")));
        return s;
    }

    private SaisieStock saisieAvecStockEtCmm(String stock, String cmm) {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal(stock));
        s.setCmm(new BigDecimal(cmm));
        return s;
    }
}
