package org.lhspla.redistribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class LigneErreurDTO {
    private int numLigne;
    private String produitCode;
    private String regle;
    private String valeurs;
}
