package org.lhspla.redistribution.dto.response;

import lombok.Data;

@Data
public class ProduitDTO {
    private Long id;
    private String code;
    private String nom;
    private String unite;
    private Long programmeId;
    private String programmeCode;
    private Boolean actif;
}
