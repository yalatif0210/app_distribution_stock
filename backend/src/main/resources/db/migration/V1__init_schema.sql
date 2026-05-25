-- Régions
CREATE TABLE regions (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Districts sanitaires
CREATE TABLE districts (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    region_id BIGINT REFERENCES regions(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Structures sanitaires
CREATE TABLE structures (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    type VARCHAR(50),
    district_id BIGINT REFERENCES districts(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Programmes de santé
CREATE TABLE programmes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- Produits / médicaments
CREATE TABLE produits (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(200) NOT NULL,
    unite VARCHAR(20) NOT NULL,
    programme_id BIGINT REFERENCES programmes(id),
    actif BOOLEAN DEFAULT TRUE
);

-- Rôles utilisateurs
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);

-- Périodes de saisie
CREATE TABLE periodes_saisie (
    id BIGSERIAL PRIMARY KEY,
    annee INTEGER NOT NULL,
    mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
    date_ras DATE NOT NULL,
    statut VARCHAR(20) DEFAULT 'OUVERTE',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Utilisateurs (doit être avant saisies_stock pour la FK)
CREATE TABLE utilisateurs (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    email VARCHAR(150),
    role_id BIGINT REFERENCES roles(id),
    structure_id BIGINT REFERENCES structures(id),
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Saisies de stock
CREATE TABLE saisies_stock (
    id BIGSERIAL PRIMARY KEY,
    periode_id BIGINT REFERENCES periodes_saisie(id),
    structure_id BIGINT REFERENCES structures(id),
    produit_id BIGINT REFERENCES produits(id),
    stock_disponible DECIMAL(12,2) NOT NULL DEFAULT 0,
    cmm DECIMAL(12,2),
    stock_securite DECIMAL(12,2),
    msd DECIMAL(8,2),
    expire_date DATE NOT NULL,
    statut_stock VARCHAR(20),
    date_saisie TIMESTAMP DEFAULT NOW(),
    saisi_par BIGINT REFERENCES utilisateurs(id),
    source VARCHAR(20) DEFAULT 'MANUEL',
    UNIQUE (periode_id, structure_id, produit_id)
);

-- Plans de réattribution
CREATE TABLE plans_reattribution (
    id BIGSERIAL PRIMARY KEY,
    periode_id BIGINT REFERENCES periodes_saisie(id),
    programme_id BIGINT REFERENCES programmes(id),
    region_id BIGINT REFERENCES regions(id),
    statut VARCHAR(30) DEFAULT 'BROUILLON',
    genere_par_ia BOOLEAN DEFAULT FALSE,
    resume_ia TEXT,
    date_generation TIMESTAMP DEFAULT NOW(),
    date_validation TIMESTAMP,
    valide_par BIGINT REFERENCES utilisateurs(id),
    date_cloture TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lignes de plan
CREATE TABLE lignes_plan (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES plans_reattribution(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    structure_source_id BIGINT REFERENCES structures(id),
    structure_cible_id BIGINT REFERENCES structures(id),
    quantite_proposee DECIMAL(12,2) NOT NULL,
    quantite_executee DECIMAL(12,2) DEFAULT 0,
    statut VARCHAR(30) DEFAULT 'EN_ATTENTE',
    date_execution TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES plans_reattribution(id),
    ligne_plan_id BIGINT REFERENCES lignes_plan(id),
    type VARCHAR(50),
    message TEXT,
    destinataire_id BIGINT REFERENCES utilisateurs(id),
    lu BOOLEAN DEFAULT FALSE,
    date_envoi TIMESTAMP DEFAULT NOW()
);

-- Index utiles
CREATE INDEX idx_saisies_stock_periode ON saisies_stock(periode_id);
CREATE INDEX idx_saisies_stock_structure ON saisies_stock(structure_id);
CREATE INDEX idx_saisies_stock_produit ON saisies_stock(produit_id);
CREATE INDEX idx_lignes_plan_plan ON lignes_plan(plan_id);
CREATE INDEX idx_notifications_destinataire ON notifications(destinataire_id);
CREATE INDEX idx_notifications_lu ON notifications(lu);
