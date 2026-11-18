-- Idempotence des écritures.
--
-- 1. Clés d'idempotence : chaque action d'écriture du navigateur porte un UUID
--    (en-tête Idempotency-Key). Le serveur garde ici la réponse pendant 24 h : si la même
--    action revient (double envoi, nouvelle tentative après une coupure), la réponse
--    enregistrée est renvoyée et rien n'est refait.
CREATE TABLE cles_idempotence (
    cle          UUID         PRIMARY KEY,
    utilisateur  VARCHAR(50)  NOT NULL,
    methode      VARCHAR(10)  NOT NULL,
    chemin       VARCHAR(500) NOT NULL,
    empreinte    CHAR(64)     NOT NULL,          -- SHA-256 de la méthode, du chemin et du corps
    statut_http  INTEGER,                        -- NULL tant que la requête est en cours
    type_contenu VARCHAR(100),
    reponse      BYTEA,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cles_idempotence_date ON cles_idempotence (created_at);

-- 2. Unicités métier qui manquaient : la base refuse les doublons même si deux requêtes
--    différentes arrivent en même temps. Chaque index n'est créé que si les données
--    existantes le permettent ; sinon un avertissement est journalisé et les doublons
--    sont à traiter à la main (le contrôle applicatif reste actif dans tous les cas).
DO $$
BEGIN
    -- Une région par nom (sans tenir compte de la casse ni des espaces autour)
    IF NOT EXISTS (SELECT 1 FROM regions GROUP BY lower(trim(nom)) HAVING COUNT(*) > 1) THEN
        CREATE UNIQUE INDEX uq_regions_nom ON regions (lower(trim(nom)));
    ELSE
        RAISE WARNING 'Régions en double par nom : index uq_regions_nom non créé';
    END IF;

    -- Un district par nom dans une région
    IF NOT EXISTS (SELECT 1 FROM districts GROUP BY region_id, lower(trim(nom)) HAVING COUNT(*) > 1) THEN
        CREATE UNIQUE INDEX uq_districts_region_nom ON districts (region_id, lower(trim(nom)));
    ELSE
        RAISE WARNING 'Districts en double par nom dans une région : index uq_districts_region_nom non créé';
    END IF;

    -- Un seul plan brouillon par période, programme (ou tous programmes) et région
    IF NOT EXISTS (SELECT 1 FROM plans_reattribution WHERE statut = 'BROUILLON'
                   GROUP BY periode_id, region_id, COALESCE(programme_id, 0) HAVING COUNT(*) > 1) THEN
        CREATE UNIQUE INDEX uq_plans_un_brouillon ON plans_reattribution (periode_id, region_id, COALESCE(programme_id, 0))
            WHERE statut = 'BROUILLON';
    ELSE
        RAISE WARNING 'Plusieurs brouillons sur un même périmètre : index uq_plans_un_brouillon non créé';
    END IF;

    -- Une seule ligne active par produit, source et cible dans un plan
    IF NOT EXISTS (SELECT 1 FROM lignes_plan WHERE statut <> 'ANNULE'
                   GROUP BY plan_id, produit_id, structure_source_id, structure_cible_id HAVING COUNT(*) > 1) THEN
        CREATE UNIQUE INDEX uq_lignes_plan_mouvement ON lignes_plan (plan_id, produit_id, structure_source_id, structure_cible_id)
            WHERE statut <> 'ANNULE';
    ELSE
        RAISE WARNING 'Lignes de plan en double : index uq_lignes_plan_mouvement non créé';
    END IF;
END $$;
