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
}
