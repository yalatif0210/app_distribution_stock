package org.lhspla.redistribution.repository;

import org.lhspla.redistribution.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByDestinataireIdOrderByDateEnvoiDesc(Long utilisateurId);
    List<Notification> findByDestinataireIdAndLuFalse(Long utilisateurId);
    long countByDestinataireIdAndLuFalse(Long utilisateurId);

    /** Une notification identique encore non lue existe-t-elle ? (évite d'empiler les mêmes alertes) */
    boolean existsByDestinataireIdAndTypeAndMessageAndLuFalse(Long utilisateurId, String type, String message);

    boolean existsByDestinataireIdAndTypeAndLignePlanIdAndLuFalse(Long utilisateurId, String type, Long lignePlanId);
}
