-- Rôles de base
INSERT INTO roles (name) VALUES ('ADMIN'), ('PHARMACIEN_REGION'), ('GESTIONNAIRE');

-- Région de démo
INSERT INTO regions (nom) VALUES ('Région Centre');

-- District de démo
INSERT INTO districts (nom, region_id) VALUES ('District Central', 1);

-- Structures de démo
INSERT INTO structures (code, nom, type, district_id) VALUES
    ('STRUCT-001', 'Hôpital Régional Central', 'HOPITAL', 1),
    ('STRUCT-002', 'Centre de Santé Nord', 'CENTRE_SANTE', 1),
    ('STRUCT-003', 'Centre de Santé Sud', 'CENTRE_SANTE', 1);

-- Programmes de démo
INSERT INTO programmes (code, nom, description) VALUES
    ('PNLS', 'Programme National de Lutte contre le SIDA', 'ARV et intrants liés au VIH'),
    ('PNLP', 'Programme National de Lutte contre le Paludisme', 'ACT et tests de diagnostic rapide'),
    ('SSR', 'Santé Sexuelle et Reproductive', 'Contraceptifs et intrants obstétricaux');

-- Produits de démo
INSERT INTO produits (code, nom, unite, programme_id) VALUES
    ('ARV-001', 'TDF/3TC/DTG 300/300/50mg', 'comprimé', 1),
    ('ARV-002', 'AZT/3TC/NVP 300/150/200mg pédiatrique', 'comprimé', 1),
    ('ACT-001', 'Artéméther/Luméfantrine 20/120mg', 'comprimé', 2),
    ('TDR-001', 'Test de Diagnostic Rapide Paludisme', 'test', 2),
    ('CON-001', 'Préservatifs masculins', 'pièce', 3);

-- Admin de démo (mot de passe : Admin@2024)
INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id)
VALUES ('admin', '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', 'Admin', 'Système', 'admin@redistribution.local', 1);
