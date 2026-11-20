-- Réception des produits par le site destinataire.
--
-- Le site destinataire confirme ce qu'il a reçu, en une ou plusieurs fois. La somme des
-- réceptions devient la quantité exécutée de la ligne. Les dates de réception, rapportées
-- à la date de validation du plan, donnent les délais d'exécution.

CREATE TABLE receptions_ligne (
    id              BIGSERIAL PRIMARY KEY,
    ligne_plan_id   BIGINT        NOT NULL REFERENCES lignes_plan(id) ON DELETE CASCADE,
    quantite        NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
    date_reception  DATE          NOT NULL,
    -- Réception déclarée terminée alors que tout n'est pas arrivé : motif de l'écart
    motif_ecart     VARCHAR(20)   CHECK (motif_ecart IN ('CASSE', 'PEREMPTION', 'MANQUANT', 'AUTRE')),
    notes           TEXT,
    saisi_par       VARCHAR(100)  NOT NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_receptions_ligne ON receptions_ligne(ligne_plan_id);

-- Dernière date de réception de la ligne, et motif si la réception a été close avec un écart
ALTER TABLE lignes_plan ADD COLUMN date_reception DATE;
ALTER TABLE lignes_plan ADD COLUMN motif_ecart VARCHAR(20)
    CHECK (motif_ecart IN ('CASSE', 'PEREMPTION', 'MANQUANT', 'AUTRE'));

-- Exécutions déjà saisies par le pharmacien avant cette version : elles deviennent une
-- réception datée du jour de la saisie, pour que l'historique et les délais restent complets.
INSERT INTO receptions_ligne (ligne_plan_id, quantite, date_reception, notes, saisi_par, created_at)
SELECT id, quantite_executee, CAST(date_execution AS DATE), 'Reprise de l''exécution saisie avant les réceptions', 'reprise', date_execution
FROM lignes_plan
WHERE quantite_executee > 0 AND date_execution IS NOT NULL;

UPDATE lignes_plan SET date_reception = CAST(date_execution AS DATE)
WHERE quantite_executee > 0 AND date_execution IS NOT NULL;
