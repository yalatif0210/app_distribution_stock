package org.lhspla.redistribution.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    // Clé factice — longueur >= 512 bits pour éviter les avertissements HS256.
    // NE PAS utiliser en production. Remplacer par une variable d'environnement sécurisée.
    private static final String PLACEHOLDER_JWT_SECRET =
            "placeholder-test-jwt-secret-key-do-not-use-in-production-environment";

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret",    PLACEHOLDER_JWT_SECRET);
        ReflectionTestUtils.setField(provider, "jwtExpiration", 3_600_000L); // 1 heure
    }

    // ── Génération ───────────────────────────────────────────────────────────────

    @Test
    void generateToken_retourne_une_chaine_non_vide() {
        String token = provider.generateToken(authPour("pharmacien01"));
        assertThat(token).isNotBlank();
    }

    @Test
    void generateToken_contient_trois_segments_JWT() {
        String token = provider.generateToken(authPour("pharmacien01"));
        // Un JWT valide = header.payload.signature
        assertThat(token.split("\\.")).hasSize(3);
    }

    // ── Extraction du username ────────────────────────────────────────────────────

    @Test
    void getUsernameFromToken_retourne_le_bon_username() {
        String token = provider.generateToken(authPour("superviseur_test"));
        assertThat(provider.getUsernameFromToken(token)).isEqualTo("superviseur_test");
    }

    @Test
    void getUsernameFromToken_fonctionne_avec_username_a_caracteres_speciaux() {
        String token = provider.generateToken(authPour("user.name_01"));
        assertThat(provider.getUsernameFromToken(token)).isEqualTo("user.name_01");
    }

    // ── Validation ───────────────────────────────────────────────────────────────

    @Test
    void validateToken_retourne_true_pour_token_valide() {
        String token = provider.generateToken(authPour("gestionnaire01"));
        assertThat(provider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_retourne_false_pour_token_modifie() {
        String token = provider.generateToken(authPour("gestionnaire01"));
        String tokenTamper = token.substring(0, token.length() - 4) + "xxxx";
        assertThat(provider.validateToken(tokenTamper)).isFalse();
    }

    @Test
    void validateToken_retourne_false_pour_token_vide() {
        assertThat(provider.validateToken("")).isFalse();
    }

    @Test
    void validateToken_retourne_false_pour_token_completement_invalide() {
        assertThat(provider.validateToken("ceci.n.est.pas.un.jwt")).isFalse();
    }

    @Test
    void validateToken_retourne_false_pour_token_signe_avec_cle_differente() {
        JwtTokenProvider autreProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(autreProvider, "jwtSecret",
                "autre-cle-differente-placeholder-test-do-not-use-prod-env");
        ReflectionTestUtils.setField(autreProvider, "jwtExpiration", 3_600_000L);

        String tokenAutreCle = autreProvider.generateToken(authPour("utilisateur_test"));
        assertThat(provider.validateToken(tokenAutreCle)).isFalse();
    }

    // ── Token expiré ─────────────────────────────────────────────────────────────

    @Test
    void validateToken_retourne_false_pour_token_expire() {
        JwtTokenProvider expireProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(expireProvider, "jwtSecret",    PLACEHOLDER_JWT_SECRET);
        ReflectionTestUtils.setField(expireProvider, "jwtExpiration", -1000L); // expiré dans le passé

        String tokenExpire = expireProvider.generateToken(authPour("utilisateur_test"));
        assertThat(provider.validateToken(tokenExpire)).isFalse();
    }

    // ── Helper ───────────────────────────────────────────────────────────────────

    private Authentication authPour(String username) {
        UserDetails userDetails = User.builder()
                .username(username)
                .password("PLACEHOLDER_PASSWORD_HASH_FOR_TESTS")
                .authorities(Collections.emptyList())
                .build();
        return new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
    }
}
