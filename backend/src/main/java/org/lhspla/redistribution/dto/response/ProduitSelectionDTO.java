package org.lhspla.redistribution.dto.response;

import lombok.Data;

@Data
public class ProduitSelectionDTO {
    private Long produitId;
    private String produitCode;
    private String produitNom;
    private String produitUnite;
    private Boolean actif;
}
