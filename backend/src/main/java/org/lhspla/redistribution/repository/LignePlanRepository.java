package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.LignePlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LignePlanRepository extends JpaRepository<LignePlan, Long> {
    List<LignePlan> findByPlanId(Long planId);
    List<LignePlan> findByStatutAndCreatedAtBefore(String statut, LocalDateTime date);

    /**
     * Somme des quantités déjà allouées depuis une source pour un produit dans un plan donné.
     * excludeLigneId permet d'exclure la ligne en cours de modification (passer -1L pour un ajout).
     */
    @Query("""
        SELECT COALESCE(SUM(l.quantiteProposee), 0)
        FROM LignePlan l
        WHERE l.plan.id           = :planId
        AND   l.structureSource.id = :structureSourceId
        AND   l.produit.id         = :produitId
        AND   l.statut             <> 'ANNULE'
        AND   l.id                 <> :excludeLigneId
    """)
    BigDecimal sumAllocations(@Param("planId")          Long planId,
                              @Param("structureSourceId") Long structureSourceId,
                              @Param("produitId")         Long produitId,
                              @Param("excludeLigneId")    Long excludeLigneId);
}
