package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.ReceptionLigne;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReceptionLigneRepository extends JpaRepository<ReceptionLigne, Long> {
    List<ReceptionLigne> findByLigneIdOrderByDateReceptionAscIdAsc(Long ligneId);
}
