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

-- 4. Seed: lier toutes les structures démo à tous les programmes (toutes actives)
INSERT INTO structure_programme (structure_id, programme_id, actif)
SELECT s.id, p.id, TRUE FROM structures s CROSS JOIN programmes p;

-- 5. Seed: utilisateur PHARMACIEN_REGION pour la région 1 (mot de passe: Admin@2024)
INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id, region_id, actif)
VALUES ('pharmacien1', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Martin', 'Jean', 'pharmacien1@redistribution.local', 2, 1, TRUE);

-- 6. Seed: utilisateur GESTIONNAIRE pour la structure 1 (mot de passe: Admin@2024)
INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id, structure_id, actif)
VALUES ('gestionnaire1', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Dubois', 'Marie', 'gestionnaire1@redistribution.local', 3, 1, TRUE);
