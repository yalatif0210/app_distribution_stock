package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ParametreRegionRequest {
    @NotNull
    @DecimalMin("0.5")
    @DecimalMax("12.0")
    private BigDecimal seuilStockSecuriteMsd;

    private Long regionId;
}
