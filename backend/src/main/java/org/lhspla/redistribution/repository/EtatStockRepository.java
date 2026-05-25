package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.EtatStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EtatStockRepository extends JpaRepository<EtatStock, Long> {

    Optional<EtatStock> findByPeriodeIdAndStructureIdAndProgrammeId(
            Long periodeId, Long structureId, Long programmeId);

    @Query("SELECT e FROM EtatStock e WHERE e.periode.id = :periodeId AND e.programme.id = :programmeId AND e.structure.district.region.id = :regionId")
    List<EtatStock> findByPeriodeAndProgrammeAndRegion(
            @Param("periodeId") Long periodeId,
            @Param("programmeId") Long programmeId,
            @Param("regionId") Long regionId);

    @Query("SELECT e FROM EtatStock e WHERE e.periode.id = :periodeId AND e.programme.id = :programmeId AND e.structure.district.region.id = :regionId AND e.statut = :statut")
    List<EtatStock> findByPeriodeAndProgrammeAndRegionAndStatut(
            @Param("periodeId") Long periodeId,
            @Param("programmeId") Long programmeId,
            @Param("regionId") Long regionId,
            @Param("statut") String statut);

    List<EtatStock> findByPeriodeId(Long periodeId);

    @Query("SELECT e FROM EtatStock e WHERE e.periode.id = :periodeId AND e.programme.id = :programmeId")
    List<EtatStock> findByPeriodeIdAndProgrammeId(@Param("periodeId") Long periodeId, @Param("programmeId") Long programmeId);

    @Query("SELECT e FROM EtatStock e WHERE e.periode.id = :periodeId")
    List<EtatStock> findAllByPeriodeId(@Param("periodeId") Long periodeId);
}
