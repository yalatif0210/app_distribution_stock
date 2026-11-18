package org.lhspla.redistribution.controller;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.PeriodeRequest;
import org.lhspla.redistribution.dto.response.PeriodeSaisieDTO;
import org.lhspla.redistribution.dto.response.UtilisateurDTO;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.lhspla.redistribution.service.PeriodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UtilisateurRepository utilisateurRepo;
    private final RoleRepository roleRepo;
    private final StructureRepository structureRepo;
    private final RegionRepository regionRepo;
    private final PasswordEncoder passwordEncoder;
    private final PeriodeService periodeService;

    @GetMapping("/utilisateurs")
    public ResponseEntity<List<UtilisateurDTO>> getUtilisateurs() {
        return ResponseEntity.ok(utilisateurRepo.findAll().stream().map(this::toDTO).toList());
    }

    @PostMapping("/utilisateurs")
    public ResponseEntity<UtilisateurDTO> createUtilisateur(@RequestBody Map<String, Object> body) {
        String username = (String) body.get("username");
        if (utilisateurRepo.findByUsername(username).isPresent()) {
            throw BusinessException.badRequest("Username déjà utilisé : " + username);
        }
        Utilisateur u = new Utilisateur();
        return ResponseEntity.ok(toDTO(applyAndSave(u, body)));
    }

    @PutMapping("/utilisateurs/{id}")
    public ResponseEntity<UtilisateurDTO> updateUtilisateur(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        Utilisateur u = utilisateurRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Utilisateur", id));
        return ResponseEntity.ok(toDTO(applyAndSave(u, body)));
    }

    @DeleteMapping("/utilisateurs/{id}")
    public ResponseEntity<Void> deactivateUtilisateur(@PathVariable Long id) {
        Utilisateur u = utilisateurRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Utilisateur", id));
        u.setActif(false);
        utilisateurRepo.save(u);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/roles")
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        return ResponseEntity.ok(roleRepo.findAll().stream()
            .map(r -> Map.of("id", (Object) r.getId(), "name", (Object) r.getName()))
            .toList());
    }

    // ─── Périodes (admin CRUD) ────────────────────────────────────────────────

    @PostMapping("/periodes")
    public ResponseEntity<PeriodeSaisieDTO> createPeriode(@RequestBody Map<String, Object> body) {
        Long regionId = ((Number) body.get("regionId")).longValue();
        PeriodeRequest req = new PeriodeRequest();
        req.setDateRas(java.time.LocalDate.parse((String) body.get("dateRas")));
        return ResponseEntity.ok(periodeService.createPeriode(req, regionId, "admin"));
    }

    @DeleteMapping("/periodes/{id}")
    public ResponseEntity<Void> deletePeriode(@PathVariable Long id) {
        periodeService.deletePeriode(id, null);
        return ResponseEntity.noContent().build();
    }

    private Utilisateur applyAndSave(Utilisateur u, Map<String, Object> body) {
        if (body.containsKey("username")) u.setUsername((String) body.get("username"));
        if (body.containsKey("nom")) u.setNom((String) body.get("nom"));
        if (body.containsKey("prenom")) u.setPrenom((String) body.get("prenom"));
        if (body.containsKey("email")) u.setEmail((String) body.get("email"));
        if (body.containsKey("actif")) u.setActif((Boolean) body.get("actif"));
        if (body.containsKey("password")) {
            String pwd = (String) body.get("password");
            if (pwd != null && !pwd.isBlank()) u.setPasswordHash(passwordEncoder.encode(pwd));
        }
        if (body.containsKey("roleId")) {
            Long roleId = ((Number) body.get("roleId")).longValue();
            u.setRole(roleRepo.findById(roleId).orElseThrow(() -> BusinessException.notFound("Role", roleId)));
        }
        if (body.containsKey("structureId")) {
            Long sid = idOuNull(body.get("structureId"));
            u.setStructure(sid != null ? structureRepo.findById(sid)
                    .orElseThrow(() -> BusinessException.notFound("Structure", sid)) : null);
        }
        if (body.containsKey("regionId")) {
            Long rid = idOuNull(body.get("regionId"));
            u.setRegion(rid != null ? regionRepo.findById(rid)
                    .orElseThrow(() -> BusinessException.notFound("Région", rid)) : null);
        }
        if (body.containsKey("supervisedRegionIds")) {
            List<?> ids = (List<?>) body.get("supervisedRegionIds");
            Set<Region> regions = ids == null ? new HashSet<>() :
                ids.stream().map(this::idOuNull).filter(java.util.Objects::nonNull)
                    .map(id -> regionRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Région", id)))
                    .collect(Collectors.toSet());
            u.getSupervisedRegions().clear();
            u.getSupervisedRegions().addAll(regions);
        }
        appliquerPerimetreDuRole(u);
        return utilisateurRepo.save(u);
    }

    /**
     * Un seul rattachement par rôle :
     * GESTIONNAIRE → une structure (sa région en découle) ;
     * PHARMACIEN_REGION → une région ;
     * SUPERVISEUR → une ou plusieurs régions ;
     * ADMIN → aucun.
     * Les champs qui ne correspondent pas au rôle sont vidés.
     */
    private void appliquerPerimetreDuRole(Utilisateur u) {
        if (u.getRole() == null) throw BusinessException.badRequest("Le rôle est obligatoire");
        switch (u.getRole().getName()) {
            case "GESTIONNAIRE" -> {
                if (u.getStructure() == null)
                    throw BusinessException.badRequest("Un gestionnaire doit être rattaché à une structure");
                u.setRegion(null);
                u.getSupervisedRegions().clear();
            }
            case "PHARMACIEN_REGION" -> {
                if (u.getRegion() == null)
                    throw BusinessException.badRequest("Un pharmacien de région doit être rattaché à une région");
                u.setStructure(null);
                u.getSupervisedRegions().clear();
            }
            case "SUPERVISEUR" -> {
                if (u.getSupervisedRegions().isEmpty())
                    throw BusinessException.badRequest("Un superviseur doit couvrir au moins une région");
                u.setStructure(null);
                u.setRegion(null);
            }
            default -> {
                u.setStructure(null);
                u.setRegion(null);
                u.getSupervisedRegions().clear();
            }
        }
    }

    /** Les formulaires envoient parfois 0 pour « aucun » : traité comme null. */
    private Long idOuNull(Object valeur) {
        if (valeur == null) return null;
        long id = ((Number) valeur).longValue();
        return id > 0 ? id : null;
    }

    private UtilisateurDTO toDTO(Utilisateur u) {
        UtilisateurDTO dto = new UtilisateurDTO();
        dto.setId(u.getId());
        dto.setUsername(u.getUsername());
        dto.setNom(u.getNom());
        dto.setPrenom(u.getPrenom());
        dto.setEmail(u.getEmail());
        dto.setActif(u.getActif());
        if (u.getRole() != null) { dto.setRoleId(u.getRole().getId()); dto.setRoleNom(u.getRole().getName()); }
        if (u.getStructure() != null) { dto.setStructureId(u.getStructure().getId()); dto.setStructureNom(u.getStructure().getNom()); }
        if (u.getRegion() != null) { dto.setRegionId(u.getRegion().getId()); dto.setRegionNom(u.getRegion().getNom()); }
        dto.setSupervisedRegionIds(u.getSupervisedRegions().stream().map(Region::getId).toList());
        return dto;
    }
}
