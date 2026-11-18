-- Périmètre des utilisateurs : un seul rattachement par rôle.
--   GESTIONNAIRE      → structure_id (sa région se déduit de la structure)
--   PHARMACIEN_REGION → region_id
--   SUPERVISEUR       → une ou plusieurs lignes dans superviseur_regions
--   ADMIN             → aucun rattachement
-- Les données existantes sont reprises avant toute suppression.

-- 1. Reprises, tant que les anciennes tables existent encore

-- Gestionnaire sans structure_id mais avec un site supervisé : on reprend ce site
UPDATE utilisateurs u
SET structure_id = (SELECT MIN(ss.structure_id) FROM superviseur_structures ss WHERE ss.utilisateur_id = u.id)
WHERE u.role_id = (SELECT id FROM roles WHERE name = 'GESTIONNAIRE')
  AND u.structure_id IS NULL;

-- Pharmacien sans region_id mais avec une région supervisée : on reprend cette région
UPDATE utilisateurs u
SET region_id = (SELECT MIN(sr.region_id) FROM superviseur_regions sr WHERE sr.utilisateur_id = u.id)
WHERE u.role_id = (SELECT id FROM roles WHERE name = 'PHARMACIEN_REGION')
  AND u.region_id IS NULL;

-- Superviseur : les districts et sites supervisés deviennent les régions qui les contiennent
INSERT INTO superviseur_regions (utilisateur_id, region_id)
SELECT DISTINCT sd.utilisateur_id, d.region_id
FROM superviseur_districts sd JOIN districts d ON d.id = sd.district_id
WHERE d.region_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO superviseur_regions (utilisateur_id, region_id)
SELECT DISTINCT ss.utilisateur_id, d.region_id
FROM superviseur_structures ss
JOIN structures s ON s.id = ss.structure_id
JOIN districts d ON d.id = s.district_id
WHERE d.region_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Le superviseur ne couvre que des régions
DROP TABLE superviseur_districts;
DROP TABLE superviseur_structures;

-- 3. Un seul rattachement par rôle
UPDATE utilisateurs SET region_id = NULL
WHERE role_id = (SELECT id FROM roles WHERE name = 'GESTIONNAIRE');

UPDATE utilisateurs SET structure_id = NULL
WHERE role_id = (SELECT id FROM roles WHERE name = 'PHARMACIEN_REGION');

UPDATE utilisateurs SET structure_id = NULL, region_id = NULL
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('SUPERVISEUR', 'ADMIN'));

DELETE FROM superviseur_regions
WHERE utilisateur_id IN (
    SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE r.name <> 'SUPERVISEUR'
);

-- 4. Garde-fou en base : jamais une structure ET une région sur le même compte
ALTER TABLE utilisateurs
    ADD CONSTRAINT chk_utilisateur_un_seul_rattachement CHECK (structure_id IS NULL OR region_id IS NULL);
