package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Réception confirmée par le site destinataire (une livraison, complète ou partielle). */
@Data
public class ReceptionRequest {
    /** Quantité arrivée lors de cette livraison. */
    @NotNull(message = "Indiquez la quantité reçue.")
    @DecimalMin(value = "0.0", inclusive = false, message = "La quantité reçue doit être supérieure à 0.")
    private BigDecimal quantite;

    @NotNull(message = "Indiquez la date de réception.")
    private LocalDate dateReception;

    /** Vrai : plus rien n'est attendu, même si le cumul reste sous la quantité prévue. */
    private boolean terminee;

    /** Obligatoire si la réception est close avec un manque : CASSE, PEREMPTION, MANQUANT, AUTRE. */
    private String motifEcart;

    @Size(max = 1000, message = "Observation trop longue (1000 caractères au plus).")
    private String notes;
}
