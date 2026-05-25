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
}
