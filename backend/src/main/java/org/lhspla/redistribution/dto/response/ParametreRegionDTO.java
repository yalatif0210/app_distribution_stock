package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class ParametreRegionDTO {
    private Long regionId;
    private String regionNom;
    private BigDecimal seuilStockSecuriteMsd;
}
