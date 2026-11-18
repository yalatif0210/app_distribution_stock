package org.lhspla.redistribution.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class StockSourceDTO {
    private BigDecimal stockBrut;
    private BigDecimal allocationsExistantes;
    private BigDecimal stockNet;
    private LocalDate  expireDateFefo;
    /** Ce que la source peut encore céder : excédent au-dessus du seuil de sécurité (ou part périmable), moins les allocations. */
    private BigDecimal quantiteMaxCessible;
    /** Seuil de sécurité de la région du plan, en mois de stock. */
    private BigDecimal seuilSecuriteMsd;
    /** Vrai si la source peut descendre sous le seuil parce que son lot périmera avant d'être consommé. */
    private boolean    exceptionPeremption;
}
