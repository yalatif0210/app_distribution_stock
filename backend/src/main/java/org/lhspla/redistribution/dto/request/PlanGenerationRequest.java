package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlanGenerationRequest {
    @NotNull
    private Long periodeId;
    private Long programmeId; // null = tous les programmes
    @NotNull
    private Long regionId;
    private String notes;
}
