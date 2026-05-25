package org.lhspla.redistribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ImportResultDTO {
    private int created;
    private int updated;
    private int errors;
    private List<String> messages;
}
