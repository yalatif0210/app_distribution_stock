package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Barèmes des analyses du tableau de bord : une seule ligne (id = 1), modifiable par l'admin. */
@Entity
@Table(name = "parametres_analyse")
@Data
@NoArgsConstructor
public class ParametresAnalyse {
    public static final short ID_UNIQUE = 1;

    @Id
    private Short id = ID_UNIQUE;

    @Column(name = "equilibrage_net_pct", nullable = false, precision = 5, scale = 1)
    private BigDecimal equilibrageNetPct;
    @Column(name = "equilibrage_modere_pct", nullable = false, precision = 5, scale = 1)
    private BigDecimal equilibrageModerePct;
    @Column(name = "alerte_horizon_jours", nullable = false)
    private Integer alerteHorizonJours;
    @Column(name = "chronique_fenetre", nullable = false)
    private Integer chroniqueFenetre;
    @Column(name = "chronique_occurrences", nullable = false)
    private Integer chroniqueOccurrences;
    @Column(name = "fiabilite_bonne_pct", nullable = false, precision = 5, scale = 1)
    private BigDecimal fiabiliteBonnePct;
    @Column(name = "fiabilite_faible_pct", nullable = false, precision = 5, scale = 1)
    private BigDecimal fiabiliteFaiblePct;
    @Column(name = "retard_jours", nullable = false)
    private Integer retardJours;
    @Column(name = "fragilite_pct", nullable = false, precision = 5, scale = 1)
    private BigDecimal fragilitePct;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
