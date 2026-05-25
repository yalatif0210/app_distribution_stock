package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByUsername(String username);
    List<Utilisateur> findByStructureId(Long structureId);
    List<Utilisateur> findByActifTrue();

    List<Utilisateur> findByRegionId(Long regionId);

    @Query("SELECT u FROM Utilisateur u WHERE u.region.id = :regionId AND u.role.name = :roleName AND u.actif = true")
    List<Utilisateur> findActiveByRegionAndRole(@Param("regionId") Long regionId, @Param("roleName") String roleName);
}
