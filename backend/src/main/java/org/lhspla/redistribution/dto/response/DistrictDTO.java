package org.lhspla.redistribution.dto.response;

import lombok.Data;

@Data
public class DistrictDTO {
    private Long id;
    private String nom;
    private Long regionId;
    private String regionNom;
}
