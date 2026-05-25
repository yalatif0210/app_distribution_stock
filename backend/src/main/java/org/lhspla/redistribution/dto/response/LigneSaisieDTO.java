package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LigneSaisieDTO {
    private Long saisieId;
    private Long produitId;
    private String produitCode;
    private String produitNom;
    private String produitUnite;
    private BigDecimal stockDisponible;
    private BigDecimal cmm;
    private BigDecimal stockSecurite;
    private BigDecimal msd;
    private LocalDate expireDate;
    private String statutStock;
    private Boolean saved;
    private Boolean risquePeremption;
    private Double surplusMois;
}
