package org.lhspla.redistribution.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Une réception enregistrée sur une ligne de plan. */
@Data
public class ReceptionDTO {
    private Long id;
    private BigDecimal quantite;
    private LocalDate dateReception;
    private String motifEcart;
    private String notes;
    private String saisiPar;
    private LocalDateTime createdAt;
}
