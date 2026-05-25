package org.lhspla.redistribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ImportResultatDTO {
    private boolean success;
    private int nbImportes;
    private List<LigneErreurDTO> erreurs;
    private List<SaisieStockDTO> importes;
}
