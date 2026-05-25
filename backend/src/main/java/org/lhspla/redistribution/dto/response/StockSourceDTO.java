package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class StockSourceDTO {
    private BigDecimal stockBrut;
    private BigDecimal allocationsExistantes;
    private BigDecimal stockNet;
    private LocalDate  expireDateFefo;
}
