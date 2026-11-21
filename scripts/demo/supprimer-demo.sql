-- ════════════════════════════════════════════════════════════════════════════
-- Suppression du jeu de démonstration
-- Supprime tout ce qui touche la « Région Démo », la « Région Démo Est » et les programmes DEMO-*, y compris
-- ce qui a été créé pendant les tests (plans, périodes, sites ajoutés dans la région…).
-- Sans effet si le jeu n'est pas chargé. Les données réelles ne sont pas touchées.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE d_regions    ON COMMIT DROP AS SELECT id FROM regions WHERE nom IN ('Région Démo', 'Région Démo Est');
CREATE TEMP TABLE d_districts  ON COMMIT DROP AS SELECT id FROM districts WHERE region_id IN (SELECT id FROM d_regions);
CREATE TEMP TABLE d_structures ON COMMIT DROP AS
    SELECT id FROM structures WHERE district_id IN (SELECT id FROM d_districts) OR code LIKE 'DEMO-%';
CREATE TEMP TABLE d_programmes ON COMMIT DROP AS SELECT id FROM programmes WHERE code LIKE 'DEMO-%';
CREATE TEMP TABLE d_produits   ON COMMIT DROP AS
    SELECT id FROM produits WHERE programme_id IN (SELECT id FROM d_programmes) OR code LIKE 'DEMO-%';
CREATE TEMP TABLE d_users      ON COMMIT DROP AS SELECT id, username FROM utilisateurs WHERE username LIKE 'demo\_%';
CREATE TEMP TABLE d_plans      ON COMMIT DROP AS
    SELECT id FROM plans_reattribution
    WHERE region_id IN (SELECT id FROM d_regions) OR programme_id IN (SELECT id FROM d_programmes);
CREATE TEMP TABLE d_periodes   ON COMMIT DROP AS SELECT id FROM periodes_saisie WHERE region_id IN (SELECT id FROM d_regions);

-- Plans et lignes (les notifications liées partent avec eux, V14)
DELETE FROM notifications WHERE destinataire_id IN (SELECT id FROM d_users);
DELETE FROM lignes_plan
 WHERE plan_id IN (SELECT id FROM d_plans)
    OR produit_id IN (SELECT id FROM d_produits)
    OR structure_source_id IN (SELECT id FROM d_structures)
    OR structure_cible_id IN (SELECT id FROM d_structures);
DELETE FROM plans_reattribution WHERE id IN (SELECT id FROM d_plans) OR periode_id IN (SELECT id FROM d_periodes);

-- Stocks
DELETE FROM saisies_stock
 WHERE structure_id IN (SELECT id FROM d_structures)
    OR produit_id IN (SELECT id FROM d_produits)
    OR periode_id IN (SELECT id FROM d_periodes);
DELETE FROM etats_stock
 WHERE structure_id IN (SELECT id FROM d_structures)
    OR programme_id IN (SELECT id FROM d_programmes)
    OR periode_id IN (SELECT id FROM d_periodes);
DELETE FROM periodes_saisie WHERE id IN (SELECT id FROM d_periodes);

-- Paramétrage des sites
DELETE FROM structure_programme_produit
 WHERE structure_id IN (SELECT id FROM d_structures)
    OR programme_id IN (SELECT id FROM d_programmes)
    OR produit_id IN (SELECT id FROM d_produits);
DELETE FROM structure_programme
 WHERE structure_id IN (SELECT id FROM d_structures)
    OR programme_id IN (SELECT id FROM d_programmes);

-- Utilisateurs : les comptes demo_* sont supprimés ; un compte réel rattaché à la région
-- ou à un site de démo (créé pendant les tests) perd seulement ce rattachement.
DELETE FROM superviseur_regions
 WHERE utilisateur_id IN (SELECT id FROM d_users) OR region_id IN (SELECT id FROM d_regions);
UPDATE utilisateurs SET structure_id = NULL WHERE structure_id IN (SELECT id FROM d_structures);
UPDATE utilisateurs SET region_id = NULL WHERE region_id IN (SELECT id FROM d_regions);
-- Traces laissées par les comptes de démo sur des données réelles
UPDATE periodes_saisie     SET cree_par = NULL      WHERE cree_par IN (SELECT id FROM d_users);
UPDATE plans_reattribution SET valide_par = NULL    WHERE valide_par IN (SELECT id FROM d_users);
UPDATE etats_stock         SET saisi_par = NULL     WHERE saisi_par IN (SELECT id FROM d_users);
UPDATE etats_stock         SET soumis_par = NULL    WHERE soumis_par IN (SELECT id FROM d_users);
UPDATE saisies_stock       SET saisi_par = NULL     WHERE saisi_par IN (SELECT id FROM d_users);
UPDATE structure_programme SET configure_par = NULL WHERE configure_par IN (SELECT id FROM d_users);
DELETE FROM cles_idempotence WHERE utilisateur IN (SELECT username FROM d_users);
DELETE FROM utilisateurs WHERE id IN (SELECT id FROM d_users);

-- Référentiel
DELETE FROM produits   WHERE id IN (SELECT id FROM d_produits);
DELETE FROM programmes WHERE id IN (SELECT id FROM d_programmes);
DELETE FROM structures WHERE id IN (SELECT id FROM d_structures);
DELETE FROM districts  WHERE id IN (SELECT id FROM d_districts);
DELETE FROM regions    WHERE id IN (SELECT id FROM d_regions);
