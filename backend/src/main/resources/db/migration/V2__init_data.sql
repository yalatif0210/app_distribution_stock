-- Données de référence indispensables au fonctionnement, et rien d'autre.
-- Les données d'exemple (région, sites, programmes, produits) sont dans backend/demo-db,
-- chargées en local seulement.

-- Rôles de base
INSERT INTO roles (name) VALUES ('ADMIN'), ('PHARMACIEN_REGION'), ('GESTIONNAIRE');

-- Compte administrateur de démarrage. Son mot de passe par défaut est public : hors mode
-- démo, DataInitializer le remplace au premier démarrage par ADMIN_INITIAL_PASSWORD (.env).
INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id)
VALUES ('admin', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Admin', 'Système', 'admin@redistribution.local', 1);
