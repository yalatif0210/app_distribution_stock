package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Programme;
import org.lhspla.redistribution.entity.StructureProgramme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StructureProgrammeRepository extends JpaRepository<StructureProgramme, Long> {

    // Structures actives pour un programme dans une région
    @Query("SELECT sp FROM StructureProgramme sp WHERE sp.programme.id = :programmeId AND sp.structure.district.region.id = :regionId AND sp.actif = true")
    List<StructureProgramme> findActiveByProgrammeAndRegion(@Param("programmeId") Long programmeId, @Param("regionId") Long regionId);

    // Toutes les structures actives pour un programme (toutes régions)
    @Query("SELECT sp FROM StructureProgramme sp WHERE sp.programme.id = :programmeId AND sp.actif = true")
    List<StructureProgramme> findActiveByProgramme(@Param("programmeId") Long programmeId);

    // Toutes liaisons pour une région (actives ou non)
    @Query("SELECT sp FROM StructureProgramme sp WHERE sp.structure.district.region.id = :regionId")
    List<StructureProgramme> findAllByRegion(@Param("regionId") Long regionId);

    // Par structure
    List<StructureProgramme> findByStructureId(Long structureId);

    // Par structure et programme
    Optional<StructureProgramme> findByStructureIdAndProgrammeId(Long structureId, Long programmeId);

    // Programmes distincts actifs dans une région
    @Query("SELECT DISTINCT sp.programme FROM StructureProgramme sp WHERE sp.structure.district.region.id = :regionId AND sp.actif = true")
    List<Programme> findActiveProgrammesByRegion(@Param("regionId") Long regionId);
}
