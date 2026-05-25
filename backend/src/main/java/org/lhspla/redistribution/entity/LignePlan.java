package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "lignes_plan")
@Data
@NoArgsConstructor
public class LignePlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private PlanReattribution plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_id")
    private Produit produit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "structure_source_id")
    private Structure structureSource;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "structure_cible_id")
    private Structure structureCible;

    @Column(name = "quantite_proposee", nullable = false, precision = 12, scale = 2)
    private BigDecimal quantiteProposee;

    @Column(name = "quantite_executee", precision = 12, scale = 2)
    private BigDecimal quantiteExecutee = BigDecimal.ZERO;

    @Column(nullable = false, length = 30)
    private String statut = "EN_ATTENTE";

    @Column(name = "date_execution")
    private LocalDateTime dateExecution;

    @Column(name = "expire_date")
    private LocalDate expireDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
