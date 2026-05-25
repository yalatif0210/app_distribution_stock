package org.lhspla.redistribution.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class CompletudeDTO {
    private Long periodeId;
    private Long programmeId;
    private Long regionId;
    private String programmeNom;
    private String periodeLibelle;
    private int totalAttendu;
    private int totalSaisi;
    private double tauxCompletude;
    private List<StructureSimpleDTO> structuresManquantes;

    @Data
    @NoArgsConstructor
    public static class StructureSimpleDTO {
        private Long id;
        private String code;
        private String nom;
        private String type;
    }
}
