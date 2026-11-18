-- Seuils de MSD qui définissent les statuts de stock, administrables par l'admin.
-- Ils étaient figés dans application.properties (1, 2 et 4 mois).
--   MSD = 0                         -> RUPTURE
--   MSD < seuil_tension             -> TENSION
--   MSD < seuil_surveiller          -> SURVEILLER
--   MSD <= seuil_surstock           -> BIEN_STOCKE
--   au-delà                         -> SURSTOCK
-- Ces statuts sont qualitatifs : l'éligibilité d'une source dépend du seuil de
-- sécurité de sa région (regions.seuil_stock_securite_msd), pas de son statut.

CREATE TABLE parametres_statut (
    id               SMALLINT     PRIMARY KEY CHECK (id = 1),
    seuil_tension    NUMERIC(4,1) NOT NULL,
    seuil_surveiller NUMERIC(4,1) NOT NULL,
    seuil_surstock   NUMERIC(4,1) NOT NULL,
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seuils_statut_ordonnes
        CHECK (seuil_tension > 0 AND seuil_tension < seuil_surveiller AND seuil_surveiller < seuil_surstock)
);

INSERT INTO parametres_statut (id, seuil_tension, seuil_surveiller, seuil_surstock)
VALUES (1, 1.0, 2.0, 4.0);
