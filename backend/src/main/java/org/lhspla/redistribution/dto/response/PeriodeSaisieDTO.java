package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PeriodeSaisieDTO {
    private Long id;
    private Integer annee;
    private Integer mois;
    private LocalDate dateRas;
    private String statut;
    private String libelle;
    private Long regionId;
    private String regionNom;
    private LocalDateTime createdAt;
}
