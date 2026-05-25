package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Produit;
import org.lhspla.redistribution.entity.StructureProgrammeProduit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StructureProgrammeProduitRepository extends JpaRepository<StructureProgrammeProduit, Long> {

    Optional<StructureProgrammeProduit> findByStructureIdAndProduitId(Long structureId, Long produitId);

    List<StructureProgrammeProduit> findByStructureIdAndProgrammeId(Long structureId, Long programmeId);

    @Query("SELECT sp.produit FROM StructureProgrammeProduit sp " +
           "WHERE sp.structure.id = :structureId AND sp.programme.id = :programmeId AND sp.actif = true " +
           "ORDER BY sp.produit.nom")
    List<Produit> findActiveProduits(@Param("structureId") Long structureId, @Param("programmeId") Long programmeId);
}
