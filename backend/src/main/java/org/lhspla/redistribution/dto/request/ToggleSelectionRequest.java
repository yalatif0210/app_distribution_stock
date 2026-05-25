package org.lhspla.redistribution.dto.request;

import lombok.Data;

@Data
public class ToggleSelectionRequest {
    private Long structureId;
    private Long programmeId;
    private Long produitId;
    private Boolean actif;
}
