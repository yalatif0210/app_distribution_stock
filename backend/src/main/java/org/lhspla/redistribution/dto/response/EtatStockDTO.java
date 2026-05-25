package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class EtatStockDTO {
    private Long id;
    private Long periodeId;
    private String periodeLibelle;
    private LocalDate periodeRas;
    private Long structureId;
    private String structureNom;
    private String structureCode;
    private Long programmeId;
    private String programmeNom;
    private String statut;
    private LocalDateTime dateCreation;
    private LocalDateTime dateSoumission;
    private List<LigneSaisieDTO> lignes;
}
