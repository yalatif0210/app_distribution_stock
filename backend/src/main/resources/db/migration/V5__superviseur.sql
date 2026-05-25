-- Rôle SUPERVISEUR
INSERT INTO roles(name) VALUES ('SUPERVISEUR');

-- Périmètre d'un superviseur : régions, districts et structures qu'il couvre
CREATE TABLE superviseur_regions (
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    region_id      BIGINT NOT NULL REFERENCES regions(id)      ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, region_id)
);

CREATE TABLE superviseur_districts (
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    district_id    BIGINT NOT NULL REFERENCES districts(id)    ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, district_id)
);

CREATE TABLE superviseur_structures (
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    structure_id   BIGINT NOT NULL REFERENCES structures(id)   ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, structure_id)
);

CREATE INDEX idx_sup_regions_user   ON superviseur_regions(utilisateur_id);
CREATE INDEX idx_sup_districts_user ON superviseur_districts(utilisateur_id);
CREATE INDEX idx_sup_structures_user ON superviseur_structures(utilisateur_id);
