package org.lhspla.redistribution.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlanGenerationRequest {
    @NotNull
    private Long periodeId;
    private Long programmeId; // null = tous les programmes
    @NotNull
    private Long regionId;
    private String notes;
    /** Vrai pour supprimer le brouillon existant du même périmètre et en générer un nouveau. */
    private boolean remplacerBrouillon;
    /**
     * Choix du pharmacien : vrai = l'IA propose un plan à réviser ; faux = répartition manuelle.
     * Absent : analyse IA (comportement d'origine).
     */
    private Boolean analyseIa;

    public boolean avecAnalyseIa() { return analyseIa == null || analyseIa; }
}
