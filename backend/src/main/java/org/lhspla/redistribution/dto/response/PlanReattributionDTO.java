package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PlanReattributionDTO {
    private Long id;
    private Long periodeId;
    private String periodeLibelle;
    private Long programmeId;
    private String programmeNom;
    private Long regionId;
    private String regionNom;
    private String statut;
    private Boolean genereParlA;
    private String resumeIa;
    private LocalDateTime dateGeneration;
    private LocalDateTime dateValidation;
    private String valideParUsername;
    private LocalDateTime dateCloture;
    private String notes;
    private List<LignePlanDTO> lignes;
    private int nbLignes;
    private int nbLignesExecutees;
    private int progression;
}
