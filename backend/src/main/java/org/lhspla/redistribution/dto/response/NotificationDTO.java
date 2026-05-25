package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationDTO {
    private Long id;
    private Long planId;
    private Long lignePlanId;
    private String type;
    private String message;
    private Boolean lu;
    private LocalDateTime dateEnvoi;
}
