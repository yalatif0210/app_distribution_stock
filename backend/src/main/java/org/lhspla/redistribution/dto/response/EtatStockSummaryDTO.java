package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class EtatStockSummaryDTO {
    private Long id;
    private Long periodeId;
    private String periodeLibelle;
    private Long structureId;
    private String structureNom;
    private String structureCode;
    private String structureType;
    private Long programmeId;
    private String programmeNom;
    private String statut;
    private LocalDateTime dateCreation;
    private LocalDateTime dateSoumission;
    private int nbLignes;
    private int nbLignesSaved;
    private int nbLignesIgnored;
}
