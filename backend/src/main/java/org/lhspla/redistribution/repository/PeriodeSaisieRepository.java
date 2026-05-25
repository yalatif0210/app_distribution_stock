package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.PeriodeSaisie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PeriodeSaisieRepository extends JpaRepository<PeriodeSaisie, Long> {
    Optional<PeriodeSaisie> findByAnneeAndMois(Integer annee, Integer mois);
    List<PeriodeSaisie> findByStatut(String statut);
    List<PeriodeSaisie> findAllByOrderByAnneeDescMoisDesc();

    List<PeriodeSaisie> findByRegionIdOrderByDateRasDesc(Long regionId);
    List<PeriodeSaisie> findByRegionIdAndStatut(Long regionId, String statut);
    Optional<PeriodeSaisie> findByRegionIdAndDateRas(Long regionId, LocalDate dateRas);

    // Compte les plans existants pour une periode/region (pour auto-fermeture)
    @Query("SELECT COUNT(DISTINCT p.programme.id) FROM PlanReattribution p WHERE p.periode.id = :periodeId AND p.region.id = :regionId AND p.statut != 'BROUILLON'")
    long countProgrammesWithValidatedPlan(@Param("periodeId") Long periodeId, @Param("regionId") Long regionId);
}
