package org.lhspla.redistribution.dto.response;

import lombok.Data;

@Data
public class StructureDTO {
    private Long id;
    private String code;
    private String nom;
    private String type;
    private Long districtId;
    private String districtNom;
    private Long regionId;
    private String regionNom;
    private Boolean active;
}
