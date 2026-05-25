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
    private final DistrictRepository districtRepo;
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
            Object sid = body.get("structureId");
            u.setStructure(sid != null ? structureRepo.findById(((Number) sid).longValue()).orElse(null) : null);
        }
        if (body.containsKey("regionId")) {
            Object rid = body.get("regionId");
            u.setRegion(rid != null ? regionRepo.findById(((Number) rid).longValue()).orElse(null) : null);
        }
        if (body.containsKey("supervisedRegionIds")) {
            List<?> ids = (List<?>) body.get("supervisedRegionIds");
            Set<Region> regions = ids == null ? new HashSet<>() :
                ids.stream().map(id -> regionRepo.findById(((Number) id).longValue()).orElseThrow())
                    .collect(Collectors.toSet());
            u.getSupervisedRegions().clear();
            u.getSupervisedRegions().addAll(regions);
        }
        if (body.containsKey("supervisedDistrictIds")) {
            List<?> ids = (List<?>) body.get("supervisedDistrictIds");
            Set<District> districts = ids == null ? new HashSet<>() :
                ids.stream().map(id -> districtRepo.findById(((Number) id).longValue()).orElseThrow())
                    .collect(Collectors.toSet());
            u.getSupervisedDistricts().clear();
            u.getSupervisedDistricts().addAll(districts);
        }
        if (body.containsKey("supervisedStructureIds")) {
            List<?> ids = (List<?>) body.get("supervisedStructureIds");
            Set<Structure> structures = ids == null ? new HashSet<>() :
                ids.stream().map(id -> structureRepo.findById(((Number) id).longValue()).orElseThrow())
                    .collect(Collectors.toSet());
            u.getSupervisedStructures().clear();
            u.getSupervisedStructures().addAll(structures);
        }
        return utilisateurRepo.save(u);
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
        dto.setSupervisedDistrictIds(u.getSupervisedDistricts().stream().map(District::getId).toList());
        dto.setSupervisedStructureIds(u.getSupervisedStructures().stream().map(Structure::getId).toList());
        return dto;
    }
}
