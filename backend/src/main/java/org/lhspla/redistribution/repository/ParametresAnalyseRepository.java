package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.ParametresAnalyse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ParametresAnalyseRepository extends JpaRepository<ParametresAnalyse, Short> {
}
