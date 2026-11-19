-- Barèmes des analyses du tableau de bord, réglables par l'admin.
-- Ils transforment les chiffres en lecture (« équilibrage net », « fiabilité faible »…)
-- et déclenchent les actions « À faire ». Une seule ligne (id = 1).
CREATE TABLE parametres_analyse (
    id                       SMALLINT PRIMARY KEY CHECK (id = 1),
    -- Dispersion des MSD : réduction de l'écart interquartile entre sites, en %
    equilibrage_net_pct      NUMERIC(5,1) NOT NULL,   -- au moins : équilibrage « net »
    equilibrage_modere_pct   NUMERIC(5,1) NOT NULL,   -- au moins : « modéré » ; en dessous : « sans effet »
    -- Alerte précoce : horizon des ruptures à venir, en jours
    alerte_horizon_jours     INTEGER      NOT NULL,
    -- Ruptures et surstocks chroniques : sur les N dernières périodes, au moins X fois
    chronique_fenetre        INTEGER      NOT NULL,
    chronique_occurrences    INTEGER      NOT NULL,
    -- Fiabilité de l'exécution : part des quantités prévues effectivement livrées, en %
    fiabilite_bonne_pct      NUMERIC(5,1) NOT NULL,   -- au moins : « bonne »
    fiabilite_faible_pct     NUMERIC(5,1) NOT NULL,   -- en dessous : « faible »
    -- Mouvement en retard : non exécuté N jours après la validation du plan
    retard_jours             INTEGER      NOT NULL,
    -- Matrice : site « fragile » si au moins ce % de ses produits est en tension ou rupture
    fragilite_pct            NUMERIC(5,1) NOT NULL,
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_parametres_analyse CHECK (
        equilibrage_modere_pct >= 0 AND equilibrage_modere_pct < equilibrage_net_pct AND equilibrage_net_pct <= 100
        AND alerte_horizon_jours BETWEEN 1 AND 365
        AND chronique_fenetre BETWEEN 2 AND 24 AND chronique_occurrences BETWEEN 1 AND chronique_fenetre
        AND fiabilite_faible_pct >= 0 AND fiabilite_faible_pct < fiabilite_bonne_pct AND fiabilite_bonne_pct <= 100
        AND retard_jours BETWEEN 1 AND 365
        AND fragilite_pct > 0 AND fragilite_pct <= 100)
);

INSERT INTO parametres_analyse (id, equilibrage_net_pct, equilibrage_modere_pct, alerte_horizon_jours,
                                chronique_fenetre, chronique_occurrences, fiabilite_bonne_pct,
                                fiabilite_faible_pct, retard_jours, fragilite_pct)
VALUES (1, 20, 5, 30, 3, 3, 90, 60, 14, 30);
