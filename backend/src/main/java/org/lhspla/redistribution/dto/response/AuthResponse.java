package org.lhspla.redistribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String username;
    private String role;
    private Long utilisateurId;
    private Long structureId;
    private Long regionId;
    private List<Long> supervisedRegionIds;
    private String structureNom;
    private String regionNom;
}
