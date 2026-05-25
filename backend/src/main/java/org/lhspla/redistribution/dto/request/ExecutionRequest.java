package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ExecutionRequest {
    @NotNull
    @DecimalMin("0.0")
    private BigDecimal quantiteExecutee;
    private String statut;
    private String notes;
}
