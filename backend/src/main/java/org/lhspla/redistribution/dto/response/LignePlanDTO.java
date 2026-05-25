package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class LignePlanDTO {
    private Long id;
    private Long produitId;
    private String produitCode;
    private String produitNom;
    private String produitUnite;
    private Long structureSourceId;
    private String structureSourceNom;
    private Long structureCibleId;
    private String structureCibleNom;
    private BigDecimal quantiteProposee;
    private BigDecimal quantiteExecutee;
    private String statut;
    private LocalDate expireDate;
    private LocalDateTime dateExecution;
    private String notes;
    private int progression;
}
