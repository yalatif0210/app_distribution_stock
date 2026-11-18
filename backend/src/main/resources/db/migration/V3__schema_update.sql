-- 1. Ajouter region_id et cree_par à periodes_saisie
ALTER TABLE periodes_saisie ADD COLUMN region_id BIGINT REFERENCES regions(id);
ALTER TABLE periodes_saisie ADD COLUMN cree_par BIGINT REFERENCES utilisateurs(id);
ALTER TABLE periodes_saisie ADD CONSTRAINT uq_periode_region_date UNIQUE (region_id, date_ras);

-- 2. Ajouter region_id à utilisateurs (pour PHARMACIEN_REGION)
ALTER TABLE utilisateurs ADD COLUMN region_id BIGINT REFERENCES regions(id);

-- 3. Nouvelle table structure_programme
CREATE TABLE structure_programme (
    id BIGSERIAL PRIMARY KEY,
    structure_id BIGINT NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
    programme_id BIGINT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    configure_par BIGINT REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (structure_id, programme_id)
);

CREATE INDEX idx_sp_structure ON structure_programme(structure_id);
CREATE INDEX idx_sp_programme ON structure_programme(programme_id);
CREATE INDEX idx_periode_region ON periodes_saisie(region_id);

-- 4. Les liens sites/programmes et les comptes d'exemple sont dans backend/demo-db
--    (V3_1), chargés en local seulement.
