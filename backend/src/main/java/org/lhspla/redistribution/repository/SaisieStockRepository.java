package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.SaisieStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SaisieStockRepository extends JpaRepository<SaisieStock, Long> {

    Optional<SaisieStock> findByPeriodeIdAndStructureIdAndProduitId(
            Long periodeId, Long structureId, Long produitId);

    Optional<SaisieStock> findByEtatIdAndProduitId(Long etatId, Long produitId);

    List<SaisieStock> findByEtatId(Long etatId);

    List<SaisieStock> findByPeriodeId(Long periodeId);

    @Query("SELECT s FROM SaisieStock s WHERE s.periode.id = :periodeId AND s.produit.programme.id = :programmeId AND s.etat.statut = 'SUBMITTED' AND (s.ignored = false OR s.ignored IS NULL)")
    List<SaisieStock> findSubmittedByPeriodeIdAndProgrammeId(
            @Param("periodeId") Long periodeId,
            @Param("programmeId") Long programmeId);

    @Query("SELECT s FROM SaisieStock s WHERE s.periode.id = :periodeId AND s.produit.programme.id = :programmeId")
    List<SaisieStock> findByPeriodeIdAndProgrammeId(
            @Param("periodeId") Long periodeId,
            @Param("programmeId") Long programmeId);

    @Query("""
        SELECT s FROM SaisieStock s
        WHERE s.periode.id = :periodeId
        AND s.produit.programme.id = :programmeId
        AND s.structure.district.region.id = :regionId
        AND s.etat.statut = 'SUBMITTED'
        AND (s.ignored = false OR s.ignored IS NULL)
    """)
    List<SaisieStock> findSubmittedByPeriodeAndProgrammeAndRegion(
            @Param("periodeId") Long periodeId,
            @Param("programmeId") Long programmeId,
            @Param("regionId") Long regionId);

    @Query("SELECT s FROM SaisieStock s WHERE s.structure.id = :structureId AND s.periode.id = :periodeId")
    List<SaisieStock> findByStructureIdAndPeriodeId(
            @Param("structureId") Long structureId,
            @Param("periodeId") Long periodeId);

    void deleteByPeriodeId(Long periodeId);
}
