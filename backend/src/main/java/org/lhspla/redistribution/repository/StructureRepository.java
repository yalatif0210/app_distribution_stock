package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Structure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StructureRepository extends JpaRepository<Structure, Long> {
    Optional<Structure> findByCode(String code);
    Optional<Structure> findByNomIgnoreCaseAndDistrictId(String nom, Long districtId);
    List<Structure> findByDistrictId(Long districtId);
    List<Structure> findByActiveTrue();

    @Query("SELECT s FROM Structure s WHERE s.district.region.id = :regionId AND s.active = true")
    List<Structure> findByRegionId(Long regionId);
}
