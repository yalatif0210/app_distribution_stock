package org.lhspla.redistribution.dto.response;

import lombok.Data;

@Data
public class ProgrammeDTO {
    private Long id;
    private String code;
    private String nom;
    private String description;
    private Boolean active;
}
