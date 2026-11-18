-- DONNÉES D'EXEMPLE : environnement local uniquement.
-- Ce dossier (backend/demo-db) n'est pas dans l'image Docker du backend : il n'est
-- monté et ajouté aux migrations Flyway que par docker-compose.local.yml
-- (FLYWAY_LOCATIONS). Ne jamais l'activer sur un serveur.

-- Sites d'exemple liés à tous les programmes, et deux comptes d'exemple
-- (anciennement dans V3 ; mot de passe Admin@2024, remis par le mode démo)
INSERT INTO structure_programme (structure_id, programme_id, actif)
SELECT s.id, p.id, TRUE FROM structures s CROSS JOIN programmes p;

INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id, region_id, actif)
VALUES ('pharmacien1', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Martin', 'Jean', 'pharmacien1@redistribution.local', 2, 1, TRUE);

INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id, structure_id, actif)
VALUES ('gestionnaire1', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Dubois', 'Marie', 'gestionnaire1@redistribution.local', 3, 1, TRUE);
