package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.entity.ParametresAnalyse;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.ParametresAnalyseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Barèmes des analyses (lecture et actions « À faire »), gardés en mémoire. */
@Service
@RequiredArgsConstructor
public class ParametresAnalyseService {

    /** Valeurs des barèmes, telles qu'échangées avec l'écran. */
    public record Baremes(double equilibrageNetPct, double equilibrageModerePct, int alerteHorizonJours,
                          int chroniqueFenetre, int chroniqueOccurrences, double fiabiliteBonnePct,
                          double fiabiliteFaiblePct, int retardJours, double fragilitePct) {}

    private final ParametresAnalyseRepository repo;
    private volatile Baremes cache;

    public Baremes baremes() {
        Baremes b = cache;
        if (b == null) {
            ParametresAnalyse p = repo.findById(ParametresAnalyse.ID_UNIQUE)
                    .orElseThrow(() -> new IllegalStateException("Table parametres_analyse vide (migration V15 absente ?)"));
            b = new Baremes(p.getEquilibrageNetPct().doubleValue(), p.getEquilibrageModerePct().doubleValue(),
                    p.getAlerteHorizonJours(), p.getChroniqueFenetre(), p.getChroniqueOccurrences(),
                    p.getFiabiliteBonnePct().doubleValue(), p.getFiabiliteFaiblePct().doubleValue(),
                    p.getRetardJours(), p.getFragilitePct().doubleValue());
            cache = b;
        }
        return b;
    }

    @Transactional
    public Baremes modifier(Baremes b) {
        if (b.equilibrageModerePct() < 0 || b.equilibrageModerePct() >= b.equilibrageNetPct() || b.equilibrageNetPct() > 100)
            throw BusinessException.badRequest("Équilibrage : 0 ≤ seuil « modéré » < seuil « net » ≤ 100 %.");
        if (b.alerteHorizonJours() < 1 || b.alerteHorizonJours() > 365)
            throw BusinessException.badRequest("Horizon d'alerte : entre 1 et 365 jours.");
        if (b.chroniqueFenetre() < 2 || b.chroniqueFenetre() > 24 || b.chroniqueOccurrences() < 1
                || b.chroniqueOccurrences() > b.chroniqueFenetre())
            throw BusinessException.badRequest("Chronicité : fenêtre de 2 à 24 périodes, occurrences entre 1 et la fenêtre.");
        if (b.fiabiliteFaiblePct() < 0 || b.fiabiliteFaiblePct() >= b.fiabiliteBonnePct() || b.fiabiliteBonnePct() > 100)
            throw BusinessException.badRequest("Fiabilité : 0 ≤ seuil « faible » < seuil « bonne » ≤ 100 %.");
        if (b.retardJours() < 1 || b.retardJours() > 365)
            throw BusinessException.badRequest("Retard : entre 1 et 365 jours.");
        if (b.fragilitePct() <= 0 || b.fragilitePct() > 100)
            throw BusinessException.badRequest("Fragilité : entre 0 et 100 %.");
        ParametresAnalyse p = repo.findById(ParametresAnalyse.ID_UNIQUE).orElseGet(ParametresAnalyse::new);
        p.setEquilibrageNetPct(java.math.BigDecimal.valueOf(b.equilibrageNetPct()));
        p.setEquilibrageModerePct(java.math.BigDecimal.valueOf(b.equilibrageModerePct()));
        p.setAlerteHorizonJours(b.alerteHorizonJours());
        p.setChroniqueFenetre(b.chroniqueFenetre());
        p.setChroniqueOccurrences(b.chroniqueOccurrences());
        p.setFiabiliteBonnePct(java.math.BigDecimal.valueOf(b.fiabiliteBonnePct()));
        p.setFiabiliteFaiblePct(java.math.BigDecimal.valueOf(b.fiabiliteFaiblePct()));
        p.setRetardJours(b.retardJours());
        p.setFragilitePct(java.math.BigDecimal.valueOf(b.fragilitePct()));
        p.setUpdatedAt(LocalDateTime.now());
        repo.save(p);
        cache = b;
        return b;
    }
}
