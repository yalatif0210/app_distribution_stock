package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Programme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProgrammeRepository extends JpaRepository<Programme, Long> {
    Optional<Programme> findByCode(String code);
    Optional<Programme> findByCodeIgnoreCase(String code);
    Optional<Programme> findByNomIgnoreCase(String nom);
    List<Programme> findByActiveTrue();
}
