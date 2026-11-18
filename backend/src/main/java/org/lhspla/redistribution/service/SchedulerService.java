package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.entity.PlanReattribution;
import org.lhspla.redistribution.repository.LignePlanRepository;
import org.lhspla.redistribution.repository.PlanReattributionRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SchedulerService {

    private final PlanReattributionRepository planRepo;
    private final LignePlanRepository ligneRepo;
    private final NotificationService notificationService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 8 * * MON")
    public void rappelPlansEnCours() {
        List<PlanReattribution> plans = planRepo.findByStatutAndDateValidationBefore(
                "VALIDE", LocalDateTime.now().minusDays(7)
        );
        log.info("Rappel hebdomadaire: {} plan(s) en cours à relancer", plans.size());
        plans.forEach(notificationService::creerRappel);
    }

    /** Les clés d'idempotence servent aux nouvelles tentatives : 24 h suffisent. */
    @Scheduled(cron = "0 15 * * * *")
    public void purgerClesIdempotence() {
        int n = jdbcTemplate.update("DELETE FROM cles_idempotence WHERE created_at < NOW() - INTERVAL '24 hours'");
        if (n > 0) log.info("{} clé(s) d'idempotence expirée(s) supprimée(s)", n);
    }

    @Scheduled(cron = "0 0 7 * * *")
    public void alerteLignesEnRetard() {
        ligneRepo.findByStatutAndCreatedAtBefore("EN_ATTENTE", LocalDateTime.now().minusDays(14))
                .forEach(ligne -> {
                    log.info("Alerte retard ligne {}", ligne.getId());
                    notificationService.alerterLignesEnRetard(ligne);
                });
    }
}
