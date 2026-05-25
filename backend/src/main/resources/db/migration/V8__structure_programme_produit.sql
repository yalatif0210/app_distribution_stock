CREATE TABLE structure_programme_produit (
    id           BIGSERIAL PRIMARY KEY,
    structure_id BIGINT  NOT NULL REFERENCES structures(id)  ON DELETE CASCADE,
    programme_id BIGINT  NOT NULL REFERENCES programmes(id)  ON DELETE CASCADE,
    produit_id   BIGINT  NOT NULL REFERENCES produits(id)    ON DELETE CASCADE,
    actif        BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (structure_id, produit_id)
);
