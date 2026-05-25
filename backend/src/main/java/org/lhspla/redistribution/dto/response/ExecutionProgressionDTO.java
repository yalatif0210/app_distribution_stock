package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class ExecutionProgressionDTO {
    private List<Item> items;

    @Data
    public static class Item {
        private Long periodeId;
        private String periodeLabel;
        private double progressionMoyenne;
        private int nbPlans;
    }
}
