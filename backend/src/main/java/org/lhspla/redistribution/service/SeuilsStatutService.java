package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.entity.ParametresStatut;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.ParametresStatutRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Seuils de MSD qui donnent le statut qualitatif d'un stock (RUPTURE, TENSION, SURVEILLER,
 * BIEN_STOCKE, SURSTOCK). Ils sont lus en base et gardés en mémoire : ils changent rarement
 * et le statut est calculé pour chaque ligne de stock.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeuilsStatutService {

    public record Seuils(BigDecimal tension, BigDecimal surveiller, BigDecimal surstock) {}

    private static final BigDecimal MAX = new BigDecimal("24");

    private final ParametresStatutRepository repo;
    private final SaisieStockRepository saisieStockRepo;

    private volatile Seuils cache;

    public Seuils seuils() {
        Seuils s = cache;
        if (s == null) {
            ParametresStatut p = repo.findById(ParametresStatut.ID_UNIQUE)
                    .orElseThrow(() -> new IllegalStateException("Table parametres_statut vide (migration V12 absente ?)"));
            s = new Seuils(p.getSeuilTension(), p.getSeuilSurveiller(), p.getSeuilSurstock());
            cache = s;
        }
        return s;
    }

    /** Statut d'un stock consommé (CMM > 0) d'après son MSD. */
    public String statut(BigDecimal msd) {
        Seuils s = seuils();
        if (msd == null || msd.signum() == 0) return "RUPTURE";
        if (msd.compareTo(s.tension()) < 0) return "TENSION";
        if (msd.compareTo(s.surveiller()) < 0) return "SURVEILLER";
        if (msd.compareTo(s.surstock()) <= 0) return "BIEN_STOCKE";
        return "SURSTOCK";
    }

    /**
     * Enregistre de nouveaux seuils et recalcule le statut enregistré de toutes les saisies,
     * pour que les vues qui lisent ce statut restent cohérentes avec les nouveaux seuils.
     */
    @Transactional
    public Seuils modifier(BigDecimal tension, BigDecimal surveiller, BigDecimal surstock) {
        if (tension == null || surveiller == null || surstock == null) {
            throw BusinessException.badRequest("Les trois seuils sont obligatoires.");
        }
        if (tension.signum() <= 0 || surstock.compareTo(MAX) > 0
                || tension.compareTo(surveiller) >= 0 || surveiller.compareTo(surstock) >= 0) {
            throw BusinessException.badRequest(
                "Les seuils doivent respecter 0 < tension < à surveiller < surstock ≤ 24 mois.");
        }
        ParametresStatut p = repo.findById(ParametresStatut.ID_UNIQUE).orElseGet(ParametresStatut::new);
        p.setSeuilTension(tension);
        p.setSeuilSurveiller(surveiller);
        p.setSeuilSurstock(surstock);
        p.setUpdatedAt(LocalDateTime.now());
        repo.save(p);
        int n = saisieStockRepo.recalculerStatuts(tension, surveiller, surstock);
        log.info("Seuils de statut modifiés ({} / {} / {}) : {} saisie(s) recalculée(s)", tension, surveiller, surstock, n);
        cache = new Seuils(tension, surveiller, surstock);
        return cache;
    }
}
