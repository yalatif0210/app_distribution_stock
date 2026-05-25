package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.NotificationDTO;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.lhspla.redistribution.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UtilisateurRepository utilisateurRepo;

    @GetMapping
    public ResponseEntity<List<NotificationDTO>> getMesNotifications(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUsrId(userDetails.getUsername());
        return ResponseEntity.ok(notificationService.findByUtilisateur(userId));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> countNonLues(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUsrId(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("count", notificationService.countNonLues(userId)));
    }

    @PutMapping("/{id}/lire")
    public ResponseEntity<Void> marquerLu(@PathVariable Long id) {
        notificationService.marquerLu(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/lire-tout")
    public ResponseEntity<Void> marquerToutLu(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUsrId(userDetails.getUsername());
        notificationService.marquerToutLu(userId);
        return ResponseEntity.ok().build();
    }

    private Long getUsrId(String username) {
        return utilisateurRepo.findByUsername(username)
                .map(Utilisateur::getId)
                .orElseThrow();
    }
}
