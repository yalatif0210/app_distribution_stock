package org.lhspla.redistribution.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Gère les comptes créés par les migrations (admin, pharmacien1, gestionnaire1),
 * dont le mot de passe par défaut "Admin@2024" est public (il figure dans le dépôt).
 *
 * - app.demo.enabled=true (poste de développement) : ces comptes sont remis à
 *   "Admin@2024" à chaque démarrage.
 * - app.demo.enabled=false (serveur) : tout compte encore sur le mot de passe par
 *   défaut le perd. "admin" reçoit app.admin.initial-password, les autres un mot
 *   de passe aléatoire (à redéfinir depuis l'administration). Un mot de passe
 *   modifié ensuite n'est plus jamais touché.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo.enabled:false}")
    private boolean demoEnabled;

    @Value("${app.admin.initial-password:}")
    private String adminInitialPassword;

    private static final String DEFAULT_PASSWORD = "Admin@2024";
    private static final String ADMIN = "admin";
    private static final String[] DEMO_USERS = {ADMIN, "pharmacien1", "gestionnaire1"};

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String username : DEMO_USERS) {
            utilisateurRepository.findByUsername(username).ifPresent(user -> {
                boolean surMotDePasseParDefaut = passwordEncoder.matches(DEFAULT_PASSWORD, user.getPasswordHash());
                if (demoEnabled) {
                    if (!surMotDePasseParDefaut) {
                        changer(user, DEFAULT_PASSWORD);
                        log.info("Mode démo : mot de passe par défaut remis pour {}", username);
                    }
                } else if (surMotDePasseParDefaut) {
                    securiser(user);
                }
            });
        }
    }

    private void securiser(Utilisateur user) {
        if (ADMIN.equals(user.getUsername())) {
            if (adminInitialPassword == null || adminInitialPassword.length() < 12) {
                throw new IllegalStateException(
                        "Le compte admin utilise encore le mot de passe par défaut : définir ADMIN_INITIAL_PASSWORD (12 caractères minimum)");
            }
            changer(user, adminInitialPassword);
            log.warn("Mot de passe par défaut du compte admin remplacé par ADMIN_INITIAL_PASSWORD");
        } else {
            changer(user, motDePasseAleatoire());
            log.warn("Compte {} : mot de passe par défaut remplacé par une valeur aléatoire, à redéfinir depuis l'administration",
                    user.getUsername());
        }
    }

    private void changer(Utilisateur user, String motDePasse) {
        user.setPasswordHash(passwordEncoder.encode(motDePasse));
        utilisateurRepository.save(user);
    }

    private static String motDePasseAleatoire() {
        byte[] octets = new byte[24];
        new SecureRandom().nextBytes(octets);
        return Base64.getEncoder().encodeToString(octets);
    }
}
