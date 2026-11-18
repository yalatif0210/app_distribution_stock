package org.lhspla.redistribution.security;

import org.lhspla.redistribution.exception.BusinessException;

import java.util.Set;

/**
 * Périmètre de données de l'utilisateur connecté.
 *
 * <ul>
 *   <li>ADMIN : tout ({@code regionIds == null}).</li>
 *   <li>PHARMACIEN_REGION : sa région, donc tous les sites de cette région.</li>
 *   <li>SUPERVISEUR : ses régions, donc tous les sites de ces régions (lecture seule).</li>
 *   <li>GESTIONNAIRE : sa structure ; sa région est celle de la structure.</li>
 * </ul>
 * Un compte mal rattaché (pas de région, pas de structure) a un périmètre vide : il ne voit rien.
 */
public record Perimetre(String role, Long structureId, Set<Long> regionIds) {

    public static final String ADMIN = "ADMIN";
    public static final String PHARMACIEN = "PHARMACIEN_REGION";
    public static final String SUPERVISEUR = "SUPERVISEUR";
    public static final String GESTIONNAIRE = "GESTIONNAIRE";

    public boolean estAdmin() { return ADMIN.equals(role); }
    public boolean estGestionnaire() { return GESTIONNAIRE.equals(role); }

    /** Régions visibles, ou {@code null} pour « toutes » (ADMIN). */
    public Set<Long> regionsVisibles() { return estAdmin() ? null : regionIds; }

    public boolean couvreRegion(Long regionId) {
        return estAdmin() || (regionId != null && regionIds.contains(regionId));
    }

    public void exigerRegion(Long regionId) {
        if (!couvreRegion(regionId)) {
            throw BusinessException.forbidden("Accès refusé : cette région est hors de votre périmètre.");
        }
    }

    /**
     * Région à utiliser pour une requête portant sur UNE région.
     * Une région demandée est vérifiée ; sans demande, on prend la région unique du
     * périmètre. Retourne {@code null} seulement pour un ADMIN sans demande (= toutes).
     */
    public Long resoudreRegion(Long demandee) {
        if (demandee != null) {
            exigerRegion(demandee);
            return demandee;
        }
        if (estAdmin()) return null;
        if (regionIds.size() == 1) return regionIds.iterator().next();
        if (regionIds.isEmpty()) {
            throw BusinessException.forbidden("Aucune région n'est rattachée à votre compte.");
        }
        throw BusinessException.badRequest("Précisez la région (paramètre regionId).");
    }

    /** Comme {@link #resoudreRegion}, mais une région est toujours obligatoire (y compris pour l'ADMIN). */
    public Long regionObligatoire(Long demandee) {
        Long regionId = resoudreRegion(demandee);
        if (regionId == null) throw BusinessException.badRequest("Précisez la région (paramètre regionId).");
        return regionId;
    }
}
