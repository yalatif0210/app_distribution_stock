package org.lhspla.redistribution.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusiness(BusinessException ex) {
        return buildError(ex.getCode(), ex.getMessage(), null, ex.getStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> details = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(err -> {
            String field = err instanceof FieldError fe ? fe.getField() : err.getObjectName();
            details.put(field, err.getDefaultMessage());
        });
        return buildError("VALIDATION_ERROR", "Données invalides", details, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccess(AccessDeniedException ex) {
        return buildError("FORBIDDEN", "Accès refusé", null, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        return buildError("UNAUTHORIZED", "Identifiants incorrects", null, HttpStatus.UNAUTHORIZED);
    }

    /** Contrainte d'unicité ou référence violée : en pratique un doublon ou un élément encore utilisé. */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrite(org.springframework.dao.DataIntegrityViolationException ex) {
        String etat = ex.getMostSpecificCause() instanceof java.sql.SQLException sql ? sql.getSQLState() : null;
        log.warn("Contrainte de base violée ({}) : {}", etat, ex.getMostSpecificCause().getMessage());
        String message = "23503".equals(etat)
                ? "Cet élément est encore utilisé ailleurs : opération impossible."
                : "Cet enregistrement existe déjà.";
        return buildError("CONFLICT", message, null, HttpStatus.CONFLICT);
    }

    /** Verrou non obtenu ou modification concurrente : l'utilisateur peut réessayer. */
    @ExceptionHandler({org.springframework.dao.PessimisticLockingFailureException.class,
                       org.springframework.orm.ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<Map<String, Object>> handleConcurrence(Exception ex) {
        log.warn("Accès concurrent : {}", ex.getMessage());
        return buildError("CONFLICT", "Cet élément est modifié en même temps par une autre action. Réessayez.",
                null, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Erreur inattendue", ex);
        return buildError("INTERNAL_ERROR", "Erreur interne du serveur", null, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<Map<String, Object>> buildError(String code, String message, Object details, HttpStatus status) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("message", message);
        body.put("details", details);
        return ResponseEntity.status(status).body(body);
    }
}
