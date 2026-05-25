package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class UtilisateurDTO {
    private Long id;
    private String username;
    private String nom;
    private String prenom;
    private String email;
    private Boolean actif;
    private Long roleId;
    private String roleNom;
    private Long structureId;
    private String structureNom;
    private Long regionId;
    private String regionNom;
    private List<Long> supervisedRegionIds;
    private List<Long> supervisedDistrictIds;
    private List<Long> supervisedStructureIds;
}
