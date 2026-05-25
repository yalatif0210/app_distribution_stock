package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "saisies_stock",
    uniqueConstraints = @UniqueConstraint(columnNames = {"periode_id", "structure_id", "produit_id"}))
@Data
@NoArgsConstructor
public class SaisieStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "periode_id", nullable = false)
    private PeriodeSaisie periode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "structure_id", nullable = false)
    private Structure structure;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etat_id")
    private EtatStock etat;

    @Column(name = "stock_disponible", nullable = false, precision = 12, scale = 2)
    private BigDecimal stockDisponible = BigDecimal.ZERO;

    @Column(precision = 12, scale = 2)
    private BigDecimal cmm;

    @Column(name = "stock_securite", precision = 12, scale = 2)
    private BigDecimal stockSecurite;

    @Column(precision = 8, scale = 2)
    private BigDecimal msd;

    @Column(name = "expire_date")
    private LocalDate expireDate;

    @Column(name = "statut_stock", length = 20)
    private String statutStock;

    @Column(name = "ignored", nullable = false)
    private Boolean ignored = false;

    @Column(name = "date_saisie")
    private LocalDateTime dateSaisie = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par")
    private Utilisateur saisiPar;

    @Column(length = 20)
    private String source = "MANUEL";
}
