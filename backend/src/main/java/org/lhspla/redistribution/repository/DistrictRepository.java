package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.District;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DistrictRepository extends JpaRepository<District, Long> {
    List<District> findByRegionId(Long regionId);
    Optional<District> findByNomIgnoreCaseAndRegionId(String nom, Long regionId);
}
