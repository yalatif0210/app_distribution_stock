package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Seuils de MSD des statuts de stock : une seule ligne (id = 1), modifiable par l'admin. */
@Entity
@Table(name = "parametres_statut")
@Data
@NoArgsConstructor
public class ParametresStatut {
    public static final short ID_UNIQUE = 1;

    @Id
    private Short id = ID_UNIQUE;

    @Column(name = "seuil_tension", nullable = false, precision = 4, scale = 1)
    private BigDecimal seuilTension;

    @Column(name = "seuil_surveiller", nullable = false, precision = 4, scale = 1)
    private BigDecimal seuilSurveiller;

    @Column(name = "seuil_surstock", nullable = false, precision = 4, scale = 1)
    private BigDecimal seuilSurstock;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
