package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.ParametresStatut;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ParametresStatutRepository extends JpaRepository<ParametresStatut, Short> {
}
