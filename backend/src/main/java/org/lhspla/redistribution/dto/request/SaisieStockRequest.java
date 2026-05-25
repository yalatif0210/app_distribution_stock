package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SaisieStockRequest {
    @NotNull
    private Long periodeId;
    @NotNull
    private Long structureId;
    @NotNull
    private Long produitId;

    @NotNull
    @DecimalMin(value = "0.0")
    private BigDecimal stockDisponible;

    @DecimalMin(value = "0.01", message = "La CMM doit être positive")
    private BigDecimal cmm;

    @NotNull
    private LocalDate expireDate;
}
