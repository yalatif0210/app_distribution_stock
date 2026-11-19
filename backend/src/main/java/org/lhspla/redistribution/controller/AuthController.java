package org.lhspla.redistribution.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.request.LoginRequest;
import org.lhspla.redistribution.dto.response.AuthResponse;
import org.lhspla.redistribution.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /** Profil à jour de l'utilisateur connecté (le jeton n'est pas renouvelé). */
    @GetMapping("/moi")
    public ResponseEntity<AuthResponse> moi(
            @org.springframework.security.core.annotation.AuthenticationPrincipal
            org.springframework.security.core.userdetails.UserDetails user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.profil(user.getUsername()));
    }
}
