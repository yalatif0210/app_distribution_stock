package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class SaisieStockDTO {
    private Long id;
    private Long periodeId;
    private String periodeLibelle;
    private Long structureId;
    private String structureNom;
    private String structureCode;
    private Long structureRegionId;
    private Long produitId;
    private String produitNom;
    private String produitCode;
    private String produitUnite;
    private BigDecimal stockDisponible;
    private BigDecimal cmm;
    private BigDecimal stockSecurite;
    private BigDecimal msd;
    private LocalDate expireDate;
    private String statutStock;
    private LocalDateTime dateSaisie;
    private String source;
}
