package org.lhspla.redistribution.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.lhspla.redistribution.entity.SaisieStock;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class AnalyseStockServiceTest {

    @Mock private SaisieStockRepository saisieStockRepo;
    @Mock private PeriodeSaisieRepository periodeRepo;
    @Mock private ProgrammeRepository programmeRepo;
    @Mock private RegionRepository regionRepo;

    @InjectMocks private AnalyseStockService service;

    @BeforeEach
    void injecterSeuils() {
        // Les @Value ne sont pas injectés par Mockito — on les force via ReflectionTestUtils
        ReflectionTestUtils.setField(service, "seuilTension",    1.0);
        ReflectionTestUtils.setField(service, "seuilSurveiller", 2.0);
        ReflectionTestUtils.setField(service, "seuilSurstock",   4.0);
        ReflectionTestUtils.setField(service, "securiteMois",    1.0);
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
        assertThat(service.calculerExcedent(s)).isEqualByComparingTo("200");
    }

    @Test
    void excedent_STOCK_DORMANT_retourne_stock_complet_quand_cmm_zero() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(new BigDecimal("75"));
        s.setCmm(BigDecimal.ZERO);
        assertThat(service.calculerExcedent(s)).isEqualByComparingTo("75");
    }

    @Test
    void excedent_zero_quand_stock_dormant_et_stock_nul() {
        SaisieStock s = new SaisieStock();
        s.setStockDisponible(BigDecimal.ZERO);
        s.setCmm(null);
        assertThat(service.calculerExcedent(s)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void excedent_positif_quand_stock_superieur_au_stock_securite() {
        // securite = cmm * securiteMois * 2 = 10 * 1.0 * 2 = 20
        // excedent = 50 - 20 = 30
        SaisieStock s = saisieAvecStockEtCmm("50", "10");
        assertThat(service.calculerExcedent(s)).isEqualByComparingTo("30");
    }

    @Test
    void excedent_zero_quand_stock_inferieur_au_stock_securite() {
        // securite = 10 * 1.0 * 2 = 20
        // stock 15 < securite 20 → excedent = 0
        SaisieStock s = saisieAvecStockEtCmm("15", "10");
        assertThat(service.calculerExcedent(s)).isEqualByComparingTo(BigDecimal.ZERO);
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
