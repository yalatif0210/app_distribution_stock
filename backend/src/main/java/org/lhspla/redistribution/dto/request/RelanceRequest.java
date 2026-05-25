package org.lhspla.redistribution.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class RelanceRequest {
    private Long periodeId;
    private Long programmeId;
    private List<Long> structureIds;
}
