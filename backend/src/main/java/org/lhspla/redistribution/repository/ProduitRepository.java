package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Produit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProduitRepository extends JpaRepository<Produit, Long> {
    Optional<Produit> findByCode(String code);
    Optional<Produit> findByCodeIgnoreCaseAndProgrammeId(String code, Long programmeId);
    Optional<Produit> findByNomIgnoreCaseAndProgrammeId(String nom, Long programmeId);
    List<Produit> findByProgrammeId(Long programmeId);
    List<Produit> findByActifTrue();
}
