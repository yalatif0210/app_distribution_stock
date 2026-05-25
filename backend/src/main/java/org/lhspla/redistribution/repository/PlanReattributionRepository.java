package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.PlanReattribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PlanReattributionRepository extends JpaRepository<PlanReattribution, Long> {
    List<PlanReattribution> findByPeriodeId(Long periodeId);
    List<PlanReattribution> findByStatut(String statut);
    List<PlanReattribution> findByPeriodeIdAndStatut(Long periodeId, String statut);
    List<PlanReattribution> findByStatutAndDateValidationBefore(String statut, LocalDateTime date);
    List<PlanReattribution> findAllByOrderByCreatedAtDesc();
    List<PlanReattribution> findByPeriodeIdAndStatutNot(Long periodeId, String statut);
    List<PlanReattribution> findByPeriodeIdAndRegionId(Long periodeId, Long regionId);
    List<PlanReattribution> findByPeriodeIdAndRegionIdAndStatutNot(Long periodeId, Long regionId, String statut);

    @Query("SELECT p FROM PlanReattribution p WHERE p.periode.annee = :annee AND p.statut <> 'BROUILLON' " +
           "AND (:regionId IS NULL OR p.region.id = :regionId) " +
           "AND (:programmeId IS NULL OR p.programme.id = :programmeId)")
    List<PlanReattribution> findForProgression(@Param("annee") int annee,
                                               @Param("regionId") Long regionId,
                                               @Param("programmeId") Long programmeId);
}
