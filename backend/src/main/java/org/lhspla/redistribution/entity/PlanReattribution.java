package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "plans_reattribution")
@Data
@NoArgsConstructor
public class PlanReattribution {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "periode_id")
    private PeriodeSaisie periode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programme_id")
    private Programme programme;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "region_id")
    private Region region;

    @Column(nullable = false, length = 30)
    private String statut = "BROUILLON";

    @Column(name = "genere_par_ia", nullable = false)
    private Boolean genereParlA = false;

    @Column(name = "resume_ia", columnDefinition = "TEXT")
    private String resumeIa;

    @Column(name = "date_generation")
    private LocalDateTime dateGeneration = LocalDateTime.now();

    @Column(name = "date_validation")
    private LocalDateTime dateValidation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par")
    private Utilisateur validePar;

    @Column(name = "date_cloture")
    private LocalDateTime dateCloture;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LignePlan> lignes;
}
