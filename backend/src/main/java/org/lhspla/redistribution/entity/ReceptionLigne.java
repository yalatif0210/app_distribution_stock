package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Une réception de produits par le site destinataire d'une ligne de plan. */
@Entity
@Table(name = "receptions_ligne")
@Data
@NoArgsConstructor
public class ReceptionLigne {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ligne_plan_id", nullable = false)
    private LignePlan ligne;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal quantite;

    @Column(name = "date_reception", nullable = false)
    private LocalDate dateReception;

    /** CASSE, PEREMPTION, MANQUANT ou AUTRE : réception close avec un écart. */
    @Column(name = "motif_ecart", length = 20)
    private String motifEcart;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "saisi_par", nullable = false, length = 100)
    private String saisiPar;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
