package org.lhspla.redistribution.dto.request;

import lombok.Data;

@Data
public class StructureProgrammeRequest {
    private Long structureId;
    private Long programmeId;
    private Boolean actif;
}
