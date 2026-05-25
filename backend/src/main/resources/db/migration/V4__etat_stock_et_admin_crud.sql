-- État de stock : document de saisie groupant les lignes par structure/période/programme
CREATE TABLE etats_stock (
    id BIGSERIAL PRIMARY KEY,
    periode_id BIGINT NOT NULL REFERENCES periodes_saisie(id),
    structure_id BIGINT NOT NULL REFERENCES structures(id),
    programme_id BIGINT NOT NULL REFERENCES programmes(id),
    statut VARCHAR(20) NOT NULL DEFAULT 'SUGGESTED',
    saisi_par BIGINT REFERENCES utilisateurs(id),
    soumis_par BIGINT REFERENCES utilisateurs(id),
    date_creation TIMESTAMP DEFAULT NOW(),
    date_soumission TIMESTAMP,
    UNIQUE (periode_id, structure_id, programme_id)
);

CREATE INDEX idx_etats_stock_lookup ON etats_stock(periode_id, structure_id, programme_id);
CREATE INDEX idx_etats_stock_statut ON etats_stock(statut);
CREATE INDEX idx_etats_stock_structure ON etats_stock(structure_id);

-- Relier chaque saisie à son état
ALTER TABLE saisies_stock ADD COLUMN etat_id BIGINT REFERENCES etats_stock(id) ON DELETE CASCADE;
ALTER TABLE saisies_stock ADD COLUMN ignored BOOLEAN NOT NULL DEFAULT FALSE;

-- expire_date devient nullable (obligatoire seulement si stock_disponible > 0)
ALTER TABLE saisies_stock ALTER COLUMN expire_date DROP NOT NULL;

CREATE INDEX idx_saisies_etat ON saisies_stock(etat_id);
