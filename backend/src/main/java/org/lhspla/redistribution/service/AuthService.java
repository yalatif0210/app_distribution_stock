package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.config.JwtTokenProvider;
import org.lhspla.redistribution.dto.request.LoginRequest;
import org.lhspla.redistribution.dto.response.AuthResponse;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authManager;
    private final JwtTokenProvider tokenProvider;
    private final UtilisateurRepository utilisateurRepository;

    public AuthResponse login(LoginRequest request) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        String token = tokenProvider.generateToken(auth);
        Utilisateur user = utilisateurRepository.findByUsername(request.getUsername()).orElseThrow();

        List<Long> supervisedRegionIds = user.getSupervisedRegions().stream()
                .map(Region::getId).toList();

        String structureNom = user.getStructure() != null ? user.getStructure().getNom() : null;
        String regionNom = user.getRegion() != null ? user.getRegion().getNom() : null;

        return new AuthResponse(
                token,
                user.getUsername(),
                user.getRole().getName(),
                user.getId(),
                user.getStructure() != null ? user.getStructure().getId() : null,
                user.getRegion() != null ? user.getRegion().getId() : null,
                supervisedRegionIds,
                structureNom,
                regionNom
        );
    }
}
