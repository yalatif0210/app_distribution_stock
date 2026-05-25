package org.lhspla.redistribution.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String DEFAULT_PASSWORD = "Admin@2024";
    private static final String[] DEMO_USERS = {"admin", "pharmacien1", "gestionnaire1"};

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String username : DEMO_USERS) {
            utilisateurRepository.findByUsername(username).ifPresent(user -> {
                if (!passwordEncoder.matches(DEFAULT_PASSWORD, user.getPasswordHash())) {
                    user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
                    utilisateurRepository.save(user);
                    log.info("Hash mot de passe mis à jour pour l'utilisateur demo: {}", username);
                }
            });
        }
    }
}
