package org.lhspla.redistribution.security;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.Structure;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.StructureRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

/** Calcule le périmètre de l'utilisateur connecté et contrôle l'accès aux régions et structures. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerimetreService {

    private final UtilisateurRepository utilisateurRepo;
    private final StructureRepository structureRepo;

    public Perimetre courant() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur u = utilisateurRepo.findByUsername(username)
                .orElseThrow(() -> BusinessException.forbidden("Utilisateur inconnu"));
        return pour(u);
    }

    public Perimetre pour(Utilisateur u) {
        String role = u.getRole() != null ? u.getRole().getName() : "";
        return switch (role) {
            case Perimetre.ADMIN -> new Perimetre(role, null, null);
            case Perimetre.PHARMACIEN -> new Perimetre(role, null,
                    u.getRegion() != null ? Set.of(u.getRegion().getId()) : Set.of());
            case Perimetre.SUPERVISEUR -> new Perimetre(role, null,
                    u.getSupervisedRegions().stream().map(Region::getId).collect(Collectors.toUnmodifiableSet()));
            case Perimetre.GESTIONNAIRE -> {
                Structure s = u.getStructure();
                Long regionId = regionDe(s);
                yield new Perimetre(role, s != null ? s.getId() : null,
                        regionId != null ? Set.of(regionId) : Set.of());
            }
            default -> new Perimetre(role, null, Set.of());
        };
    }

    /** Région d'une structure (structure → district → région). */
    public Long regionDeStructure(Long structureId) {
        Structure s = structureRepo.findById(structureId)
                .orElseThrow(() -> BusinessException.notFound("Structure", structureId));
        return regionDe(s);
    }

    /**
     * Accès à une structure : le gestionnaire seulement à la sienne, les autres
     * rôles à toute structure d'une région de leur périmètre.
     */
    public void exigerStructure(Long structureId) {
        if (structureId == null) throw BusinessException.badRequest("Structure non précisée");
        Perimetre p = courant();
        if (p.estGestionnaire()) {
            if (!structureId.equals(p.structureId())) {
                throw BusinessException.forbidden("Accès refusé : vous n'avez accès qu'à votre propre structure.");
            }
            return;
        }
        p.exigerRegion(regionDeStructure(structureId));
    }

    private static Long regionDe(Structure s) {
        if (s == null || s.getDistrict() == null || s.getDistrict().getRegion() == null) return null;
        return s.getDistrict().getRegion().getId();
    }
}
