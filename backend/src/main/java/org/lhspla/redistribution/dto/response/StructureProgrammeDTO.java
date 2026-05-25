package org.lhspla.redistribution.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class StructureProgrammeDTO {
    private Long id;
    private Long structureId;
    private String structureCode;
    private String structureNom;
    private String structureType;
    private Long programmeId;
    private String programmeCode;
    private String programmeNom;
    private Boolean actif;
}
