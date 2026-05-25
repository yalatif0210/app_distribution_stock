package org.lhspla.redistribution.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LigneSaisieRequest {
    private Long etatId;
    private Long produitId;
    private BigDecimal stockDisponible;
    private BigDecimal cmm;
    private LocalDate expireDate;
}
