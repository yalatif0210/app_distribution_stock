package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class LignePlanRequest {
    @NotNull
    private Long produitId;
    @NotNull
    private Long structureSourceId;
    @NotNull
    private Long structureCibleId;
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal quantiteProposee;
    private String notes;
}
