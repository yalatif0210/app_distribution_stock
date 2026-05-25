package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "etats_stock",
    uniqueConstraints = @UniqueConstraint(columnNames = {"periode_id", "structure_id", "programme_id"}))
@Data
@NoArgsConstructor
public class EtatStock {

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
    @JoinColumn(name = "programme_id", nullable = false)
    private Programme programme;

    @Column(nullable = false, length = 20)
    private String statut = "SUGGESTED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par")
    private Utilisateur saisiPar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "soumis_par")
    private Utilisateur soumispar;

    @Column(name = "date_creation")
    private LocalDateTime dateCreation = LocalDateTime.now();

    @Column(name = "date_soumission")
    private LocalDateTime dateSoumission;
}
