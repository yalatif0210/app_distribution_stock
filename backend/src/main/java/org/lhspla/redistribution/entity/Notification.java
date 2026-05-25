package org.lhspla.redistribution.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id")
    private PlanReattribution plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ligne_plan_id")
    private LignePlan lignePlan;

    @Column(length = 50)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destinataire_id")
    private Utilisateur destinataire;

    @Column(nullable = false)
    private Boolean lu = false;

    @Column(name = "date_envoi")
    private LocalDateTime dateEnvoi = LocalDateTime.now();
}
