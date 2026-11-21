-- ════════════════════════════════════════════════════════════════════════════
-- Jeu de démonstration complet : « Région Démo » et « Région Démo Est »
--
-- Charge deux régions fictives pour tester et présenter l'application de bout en bout :
--   • Région Démo : 3 districts, 9 sites (dont 1 inactif) ; Région Démo Est : 2 districts,
--     4 sites ; 3 programmes DEMO-*, 13 produits ;
--   • 16 comptes demo_* (mot de passe Admin@2024) : administrateur, pharmaciens,
--     superviseur, gestionnaires ;
--   • 6 périodes par région : M-5 à M-1 fermées avec historique et plans, M ouverte ;
--   • réceptions confirmées par les sites (livraisons en plusieurs fois, écarts déclarés),
--     délais d'exécution différents d'une région à l'autre ;
--   • sur la période en cours de la Région Démo, tous les cas de redistribution (README.md).
--
-- Les dates sont calculées depuis la date du jour : le jeu reste valable dans le temps.
-- Rejouable : le jeu existant est d'abord supprimé (supprimer-demo.sql).
-- À NE PAS charger en production.
-- ════════════════════════════════════════════════════════════════════════════

\ir supprimer-demo.sql

-- ── Référentiel ─────────────────────────────────────────────────────────────
INSERT INTO regions (nom, seuil_stock_securite_msd) VALUES ('Région Démo', 2.0), ('Région Démo Est', 2.5);

INSERT INTO districts (nom, region_id)
SELECT v.d, r.id
FROM (VALUES ('District Démo Nord', 'Région Démo'), ('District Démo Centre', 'Région Démo'),
             ('District Démo Sud', 'Région Démo'),
             ('District Démo Littoral', 'Région Démo Est'), ('District Démo Plateau', 'Région Démo Est')) v(d, region)
JOIN regions r ON r.nom = v.region;

INSERT INTO structures (code, nom, type, district_id, active)
SELECT v.code, v.nom, v.type, d.id, v.active
FROM (VALUES
    ('DEMO-CHR',   'Centre hospitalier régional Démo', 'HOPITAL',      'District Démo Centre',   TRUE),
    ('DEMO-DEP',   'Dépôt régional Démo',              'DEPOT',        'District Démo Centre',   TRUE),
    ('DEMO-FIA',   'CSB Fiadanana',                    'CENTRE_SANTE', 'District Démo Centre',   TRUE),
    ('DEMO-AMB',   'CSB Ambatomena',                   'CENTRE_SANTE', 'District Démo Nord',     TRUE),
    ('DEMO-ANT',   'CSB Antsahabe',                    'CENTRE_SANTE', 'District Démo Nord',     TRUE),
    ('DEMO-VOH',   'CSB Vohitra (fermé)',              'CENTRE_SANTE', 'District Démo Nord',     FALSE),
    ('DEMO-MAH',   'CSB Mahasoa',                      'CENTRE_SANTE', 'District Démo Sud',      TRUE),
    ('DEMO-TAN',   'CSB Tanambao',                     'CENTRE_SANTE', 'District Démo Sud',      TRUE),
    ('DEMO-ANK',   'Dispensaire Ankadibe',             'DISPENSAIRE',  'District Démo Sud',      TRUE),
    ('DEMO-E-CHR', 'Centre hospitalier Est Démo',      'HOPITAL',      'District Démo Littoral', TRUE),
    ('DEMO-E-AMR', 'CSB Ambodirano',                   'CENTRE_SANTE', 'District Démo Littoral', TRUE),
    ('DEMO-E-MAV', 'CSB Mahavelo',                     'CENTRE_SANTE', 'District Démo Plateau',  TRUE),
    ('DEMO-E-ATS', 'Dispensaire Antsiraka',            'DISPENSAIRE',  'District Démo Plateau',  TRUE)
) v(code, nom, type, district, active)
JOIN districts d ON d.nom = v.district;

INSERT INTO programmes (code, nom, description, active) VALUES
    ('DEMO-PALU', 'Paludisme (démo)',              'Programme fictif du jeu de démonstration', TRUE),
    ('DEMO-PF',   'Planification familiale (démo)', 'Programme fictif du jeu de démonstration', TRUE),
    ('DEMO-SMI',  'Santé maternelle (démo)',        'Programme fictif du jeu de démonstration', TRUE);

INSERT INTO produits (code, nom, unite, programme_id, actif)
SELECT v.code, v.nom, v.unite, p.id, TRUE
FROM (VALUES
    ('DEMO-ACT-AD',  'ASAQ adulte 100/270 mg',             'plaquette', 'DEMO-PALU'),
    ('DEMO-ACT-EN',  'ASAQ enfant 25/67,5 mg',             'plaquette', 'DEMO-PALU'),
    ('DEMO-TDR',     'Test de diagnostic rapide paludisme', 'test',      'DEMO-PALU'),
    ('DEMO-SP',      'Sulfadoxine-pyriméthamine 500/25 mg', 'comprimé',  'DEMO-PALU'),
    ('DEMO-ART-INJ', 'Artésunate injectable 60 mg',        'flacon',    'DEMO-PALU'),
    ('DEMO-DMPA',    'Médroxyprogestérone injectable',     'flacon',    'DEMO-PF'),
    ('DEMO-COC',     'Contraceptif oral combiné',          'plaquette', 'DEMO-PF'),
    ('DEMO-IMPL',    'Implant contraceptif',               'unité',     'DEMO-PF'),
    ('DEMO-PRES',    'Préservatif masculin',               'pièce',     'DEMO-PF'),
    ('DEMO-OCYT',    'Ocytocine 10 UI',                    'ampoule',   'DEMO-SMI'),
    ('DEMO-MGSO4',   'Sulfate de magnésium 50 %',          'ampoule',   'DEMO-SMI'),
    ('DEMO-FER',     'Fer + acide folique',                'comprimé',  'DEMO-SMI'),
    ('DEMO-AMOX',    'Amoxicilline dispersible 250 mg',    'comprimé',  'DEMO-SMI')
) v(code, nom, unite, programme)
JOIN programmes p ON p.code = v.programme;

-- Programmes suivis par chaque site (le dépôt ne fait pas de santé maternelle,
-- le site fermé n'en suit aucun)
INSERT INTO structure_programme (structure_id, programme_id, actif)
SELECT s.id, p.id, TRUE
FROM structures s CROSS JOIN programmes p
WHERE s.code LIKE 'DEMO-%' AND s.code <> 'DEMO-VOH' AND p.code LIKE 'DEMO-%'
  AND NOT (s.code = 'DEMO-DEP' AND p.code = 'DEMO-SMI');

-- Produits suivis par site : tout le programme, sauf quelques exclusions réalistes
INSERT INTO structure_programme_produit (structure_id, programme_id, produit_id, actif)
SELECT sp.structure_id, sp.programme_id, pr.id,
       NOT ((s.code = 'DEMO-DEP' AND pr.code IN ('DEMO-ACT-EN', 'DEMO-TDR', 'DEMO-COC'))
         OR (s.code IN ('DEMO-ANT', 'DEMO-MAH', 'DEMO-TAN', 'DEMO-ANK', 'DEMO-E-MAV', 'DEMO-E-ATS') AND pr.code = 'DEMO-IMPL')
         OR (s.code = 'DEMO-CHR' AND pr.code = 'DEMO-AMOX'))
FROM structure_programme sp
JOIN structures s ON s.id = sp.structure_id
JOIN produits pr ON pr.programme_id = sp.programme_id
WHERE s.code LIKE 'DEMO-%';

-- ── Comptes (mot de passe : Admin@2024) ─────────────────────────────────────
INSERT INTO utilisateurs (username, password_hash, nom, prenom, email, role_id, structure_id, region_id, actif)
SELECT v.username, '$2b$10$b3CMiGM2Bhppin0ncvC5mujq71kQc3dsvaL0EFeBubeOyjAqT5YPu', v.nom, v.prenom,
       v.username || '@demo.local', r.id,
       (SELECT id FROM structures WHERE code = v.site),
       (SELECT id FROM regions WHERE nom = v.region),
       TRUE
FROM (VALUES
    ('demo_admin',          'Rasoanaivo', 'Lalao',    'ADMIN',             NULL,         NULL),
    ('demo_pharmacien',     'Rakoto',     'Hanta',    'PHARMACIEN_REGION', NULL,         'Région Démo'),
    ('demo_pharmacien_est', 'Rafidy',     'Tojo',     'PHARMACIEN_REGION', NULL,         'Région Démo Est'),
    ('demo_superviseur',    'Andria',     'Faly',     'SUPERVISEUR',       NULL,         NULL),
    ('demo_gest_chr',       'Rabe',       'Soa',      'GESTIONNAIRE',      'DEMO-CHR',   NULL),
    ('demo_gest_dep',       'Randria',    'Tiana',    'GESTIONNAIRE',      'DEMO-DEP',   NULL),
    ('demo_gest_fia',       'Razafy',     'Lova',     'GESTIONNAIRE',      'DEMO-FIA',   NULL),
    ('demo_gest_amb',       'Rasoa',      'Mamy',     'GESTIONNAIRE',      'DEMO-AMB',   NULL),
    ('demo_gest_ant',       'Ranaivo',    'Nirina',   'GESTIONNAIRE',      'DEMO-ANT',   NULL),
    ('demo_gest_mah',       'Rajao',      'Fara',     'GESTIONNAIRE',      'DEMO-MAH',   NULL),
    ('demo_gest_tan',       'Rasolo',     'Haja',     'GESTIONNAIRE',      'DEMO-TAN',   NULL),
    ('demo_gest_ank',       'Ravelo',     'Voahangy', 'GESTIONNAIRE',      'DEMO-ANK',   NULL),
    ('demo_gest_est_chr',   'Rakotobe',   'Miora',    'GESTIONNAIRE',      'DEMO-E-CHR', NULL),
    ('demo_gest_est_amr',   'Raharison',  'Feno',     'GESTIONNAIRE',      'DEMO-E-AMR', NULL),
    ('demo_gest_est_mav',   'Rabemanana', 'Toky',     'GESTIONNAIRE',      'DEMO-E-MAV', NULL),
    ('demo_gest_est_ats',   'Ratsimba',   'Onja',     'GESTIONNAIRE',      'DEMO-E-ATS', NULL)
) v(username, nom, prenom, role, site, region)
JOIN roles r ON r.name = v.role;

-- Le superviseur couvre les deux régions de démonstration (cas multi-régions)
INSERT INTO superviseur_regions (utilisateur_id, region_id)
SELECT u.id, r.id FROM utilisateurs u
JOIN regions r ON r.nom IN ('Région Démo', 'Région Démo Est')
WHERE u.username = 'demo_superviseur';

-- ── Périodes : M-5 à M-1 fermées, M ouverte, dans chaque région ─────────────
INSERT INTO periodes_saisie (annee, mois, date_ras, statut, region_id, cree_par, created_at)
SELECT EXTRACT(YEAR FROM x.d)::int, EXTRACT(MONTH FROM x.d)::int, x.d,
       CASE WHEN v.decalage = 0 THEN 'OUVERTE' ELSE 'FERMEE' END,
       r.id, (SELECT id FROM utilisateurs WHERE region_id = r.id AND username LIKE 'demo\_pharmacien%'), x.d
FROM generate_series(0, 5) v(decalage)
CROSS JOIN regions r
CROSS JOIN LATERAL (SELECT (date_trunc('month', CURRENT_DATE) - make_interval(months => v.decalage))::date AS d) x
WHERE r.nom IN ('Région Démo', 'Région Démo Est');

CREATE TEMP TABLE demo_periodes ON COMMIT DROP AS
SELECT p.id, p.region_id, r.nom AS region,
       (EXTRACT(YEAR FROM age(date_trunc('month', CURRENT_DATE), p.date_ras)) * 12
        + EXTRACT(MONTH FROM age(date_trunc('month', CURRENT_DATE), p.date_ras)))::int AS decalage, p.date_ras
FROM periodes_saisie p JOIN regions r ON r.id = p.region_id
WHERE r.nom IN ('Région Démo', 'Région Démo Est');

-- ── Période en cours : situation de chaque site, produit par produit ────────
-- stock, CMM, jours avant péremption du lot (NULL si stock nul).
-- Seuil de sécurité : 2 mois (Région Démo), 2,5 mois (Région Démo Est). Statuts : tension < 1,
-- à surveiller < 2, bien stocké ≤ 4, surstock au-delà.
CREATE TEMP TABLE demo_situation (site TEXT, produit TEXT, stock NUMERIC, cmm NUMERIC, jours INT) ON COMMIT DROP;
INSERT INTO demo_situation VALUES
    -- ACT adulte : redistribution POSSIBLE, avec les trois sortes de sources
    ('DEMO-CHR','DEMO-ACT-AD', 600,100, 420),  -- MSD 6 surstock : cède 400
    ('DEMO-DEP','DEMO-ACT-AD', 300,  0, 300),  -- stock dormant : cède tout
    ('DEMO-FIA','DEMO-ACT-AD', 150, 50, 360),  -- MSD 3 « bien stocké » au-dessus du seuil : cède 50
    ('DEMO-AMB','DEMO-ACT-AD',  20, 80, 270),  -- tension
    ('DEMO-ANT','DEMO-ACT-AD',   0, 60, NULL), -- rupture
    ('DEMO-MAH','DEMO-ACT-AD',  45, 60, 240),  -- tension
    ('DEMO-TAN','DEMO-ACT-AD', 100, 60, 300),  -- MSD 1,67 à surveiller : ni source ni cible
    ('DEMO-ANK','DEMO-ACT-AD',  70, 30, 330),
    -- ACT enfant : sources INSUFFISANTES ; un site pile au seuil (cède 0)
    ('DEMO-CHR','DEMO-ACT-EN', 250,100, 360),  -- MSD 2,5 : cède 50
    ('DEMO-AMB','DEMO-ACT-EN',  10, 60, 270),
    ('DEMO-ANT','DEMO-ACT-EN',  30, 70, 270),
    ('DEMO-FIA','DEMO-ACT-EN',  90, 50, 300),
    ('DEMO-MAH','DEMO-ACT-EN',   0, 40, NULL),
    ('DEMO-TAN','DEMO-ACT-EN',  80, 40, 300),  -- MSD 2,0 = seuil : rien à céder
    ('DEMO-ANK','DEMO-ACT-EN',  40, 20, 270),
    -- TDR : des sites en tension mais AUCUNE source (diagnostic affiché) ;
    -- Tanambao en rupture chaque mois (rupture chronique)
    ('DEMO-CHR','DEMO-TDR',    300,200, 300),
    ('DEMO-AMB','DEMO-TDR',     50,100, 300),
    ('DEMO-ANT','DEMO-TDR',    180,100, 300),
    ('DEMO-FIA','DEMO-TDR',    190,100, 300),
    ('DEMO-MAH','DEMO-TDR',    150, 80, 300),
    ('DEMO-TAN','DEMO-TDR',      0, 50, NULL),
    ('DEMO-ANK','DEMO-TDR',     70, 40, 300),
    -- SP : tout va bien, aucun site en tension (le produit n'apparaît pas)
    ('DEMO-CHR','DEMO-SP',     500,200, 540),
    ('DEMO-DEP','DEMO-SP',     900,300, 540),
    ('DEMO-FIA','DEMO-SP',     250,100, 540),
    ('DEMO-AMB','DEMO-SP',     220,100, 540),
    ('DEMO-ANT','DEMO-SP',     300,100, 540),
    ('DEMO-MAH','DEMO-SP',     180, 80, 540),
    ('DEMO-TAN','DEMO-SP',     210, 70, 540),
    ('DEMO-ANK','DEMO-SP',     120, 50, 540),
    -- Artésunate : exception péremption et site en tension à double rôle
    ('DEMO-CHR','DEMO-ART-INJ', 90, 40,  30),  -- MSD 2,25 ; lot périmé dans 1 mois : cède 50 (au lieu de 10)
    ('DEMO-DEP','DEMO-ART-INJ', 40, 10, 720),  -- MSD 4 : cède 20
    ('DEMO-AMB','DEMO-ART-INJ', 18, 20,  15),  -- tension ET lot périmé dans 15 j : cède 8, reçoit aussi
    ('DEMO-ANT','DEMO-ART-INJ',  5, 20, 180),
    ('DEMO-FIA','DEMO-ART-INJ',  0, 15, NULL),
    ('DEMO-MAH','DEMO-ART-INJ', 30, 15, 360),
    ('DEMO-TAN','DEMO-ART-INJ', 25, 20, 360),
    ('DEMO-ANK','DEMO-ART-INJ', 12,  8, 360),
    -- DMPA : deux ruptures, un gros surstock, un stock dormant au dépôt
    ('DEMO-CHR','DEMO-DMPA',   800,100, 120),  -- MSD 8 : cède 600
    ('DEMO-DEP','DEMO-DMPA',   400,  0, 365),  -- dormant
    ('DEMO-AMB','DEMO-DMPA',     0, 50, NULL),
    ('DEMO-ANT','DEMO-DMPA',     0, 40, NULL),
    ('DEMO-FIA','DEMO-DMPA',   120, 40, 300),  -- MSD 3 : cède 40
    ('DEMO-MAH','DEMO-DMPA',    25, 50, 200),
    ('DEMO-TAN','DEMO-DMPA',    70, 30, 250),  -- saisie non soumise (exclue de l'analyse)
    ('DEMO-ANK','DEMO-DMPA',    60, 30, 300),
    -- Pilule : une seule source, juste au-dessus du seuil
    ('DEMO-CHR','DEMO-COC',    260,100, 300),  -- MSD 2,6 : cède 60
    ('DEMO-AMB','DEMO-COC',     40, 80, 300),
    ('DEMO-ANT','DEMO-COC',    150,100, 300),
    ('DEMO-FIA','DEMO-COC',     90, 60, 300),
    ('DEMO-MAH','DEMO-COC',     70, 50, 300),
    ('DEMO-TAN','DEMO-COC',     45, 30, 300),  -- saisie non soumise
    ('DEMO-ANK','DEMO-COC',     55, 40, 300),
    -- Implant : seule source le stock dormant du dépôt ; non suivi par plusieurs sites
    ('DEMO-DEP','DEMO-IMPL',   150,  0, 500),
    ('DEMO-CHR','DEMO-IMPL',    10, 15, 400),
    ('DEMO-AMB','DEMO-IMPL',     0,  5, NULL),
    ('DEMO-FIA','DEMO-IMPL',     8,  6, 400),
    -- Préservatifs : surstock partout, aucune tension (surstock chronique)
    ('DEMO-CHR','DEMO-PRES',  3000,400, 700),
    ('DEMO-DEP','DEMO-PRES',  5000,  0, 700),
    ('DEMO-AMB','DEMO-PRES',  1200,200, 700),
    ('DEMO-ANT','DEMO-PRES',  1000,150, 700),
    ('DEMO-FIA','DEMO-PRES',   900,150, 700),
    ('DEMO-MAH','DEMO-PRES',   800,100, 700),
    ('DEMO-ANK','DEMO-PRES',   500, 80, 700),
    -- Ocytocine : rupture à l'hôpital, plusieurs centres de santé peuvent céder
    ('DEMO-CHR','DEMO-OCYT',     0,300, NULL),
    ('DEMO-AMB','DEMO-OCYT',   400, 60, 200),  -- MSD 6,7 : cède 280
    ('DEMO-ANT','DEMO-OCYT',   250, 50, 180),  -- MSD 5 : cède 150
    ('DEMO-FIA','DEMO-OCYT',   120, 40, 200),  -- MSD 3 : cède 40
    ('DEMO-MAH','DEMO-OCYT',    90, 45, 200),  -- MSD 2 : rien
    ('DEMO-TAN','DEMO-OCYT',    60, 30, 200),
    -- Sulfate de magnésium : source « à surveiller » dont le lot va périmer
    ('DEMO-CHR','DEMO-MGSO4',   30, 60, 200),
    ('DEMO-AMB','DEMO-MGSO4',   50, 30,  20),  -- MSD 1,67, lot périmé dans 20 j : cède 30 sous le seuil
    ('DEMO-ANT','DEMO-MGSO4',   70, 40, 300),
    ('DEMO-FIA','DEMO-MGSO4',  130, 40, 300),  -- MSD 3,25 : cède 50
    ('DEMO-MAH','DEMO-MGSO4',   35, 40, 300),
    ('DEMO-TAN','DEMO-MGSO4',   50, 25, 300),
    -- Fer : grandes quantités ; Mahasoa en rupture chaque mois (rupture chronique)
    ('DEMO-CHR','DEMO-FER',   5000,1000, 500),
    ('DEMO-AMB','DEMO-FER',    300, 800, 500),
    ('DEMO-ANT','DEMO-FER',   1200, 600, 500),
    ('DEMO-FIA','DEMO-FER',   2400, 600, 500),
    ('DEMO-MAH','DEMO-FER',      0, 700, NULL),
    ('DEMO-TAN','DEMO-FER',    900, 500, 500),
    -- Amoxicilline : non suivie par l'hôpital
    ('DEMO-AMB','DEMO-AMOX',   100,200, 300),
    ('DEMO-ANT','DEMO-AMOX',   900,150, 300),  -- MSD 6 : cède 600
    ('DEMO-FIA','DEMO-AMOX',   300,150, 300),
    ('DEMO-MAH','DEMO-AMOX',    50,100, 300),
    ('DEMO-TAN','DEMO-AMOX',   400,100, 300);  -- MSD 4 : cède 200

-- Région Démo Est : chaque site reprend le profil d'un site de la Région Démo, à une autre
-- échelle (l'hôpital comme le CHR, Ambodirano comme Ambatomena, etc.)
INSERT INTO demo_situation
SELECT v.site_est, m.produit, ROUND(m.stock * v.echelle), ROUND(m.cmm * v.echelle), m.jours
FROM demo_situation m
JOIN (VALUES ('DEMO-E-CHR', 'DEMO-CHR', 0.8), ('DEMO-E-AMR', 'DEMO-AMB', 1.2),
             ('DEMO-E-MAV', 'DEMO-FIA', 0.9), ('DEMO-E-ATS', 'DEMO-ANT', 0.7)) v(site_est, modele, echelle)
  ON m.site = v.modele;

-- Couples en rupture chaque mois (ruptures chroniques) et en surstock chaque mois
CREATE TEMP TABLE demo_chroniques (site TEXT, produit TEXT, nature TEXT) ON COMMIT DROP;
INSERT INTO demo_chroniques VALUES
    ('DEMO-MAH', 'DEMO-FER', 'RUPTURE'), ('DEMO-TAN', 'DEMO-TDR', 'RUPTURE'),
    ('DEMO-E-ATS', 'DEMO-ACT-AD', 'RUPTURE');

-- ── États de stock ──────────────────────────────────────────────────────────
-- Périodes passées : tout est soumis. Période en cours de la Région Démo : complétude partielle
--   • Dispensaire Ankadibe : paludisme en cours de saisie, santé maternelle pas commencée ;
--   • CSB Tanambao : planification familiale en cours de saisie (non soumise).
CREATE TEMP TABLE demo_incomplets (site TEXT, programme TEXT, etat TEXT) ON COMMIT DROP;
INSERT INTO demo_incomplets VALUES
    ('DEMO-ANK', 'DEMO-PALU', 'SUGGESTED'), ('DEMO-TAN', 'DEMO-PF', 'SUGGESTED'), ('DEMO-ANK', 'DEMO-SMI', 'ABSENT');

INSERT INTO etats_stock (periode_id, structure_id, programme_id, statut, saisi_par, soumis_par, date_creation, date_soumission)
SELECT dp.id, sp.structure_id, sp.programme_id,
       COALESCE(i.etat, 'SUBMITTED'),
       g.id,
       CASE WHEN i.etat IS NULL THEN g.id END,
       dp.date_ras + INTERVAL '2 days',
       CASE WHEN i.etat IS NULL THEN LEAST(dp.date_ras + INTERVAL '5 days', NOW() - INTERVAL '1 hour') END
FROM demo_periodes dp
CROSS JOIN structure_programme sp
JOIN structures s ON s.id = sp.structure_id AND s.code LIKE 'DEMO-%'
JOIN districts di ON di.id = s.district_id AND di.region_id = dp.region_id
JOIN programmes p ON p.id = sp.programme_id
LEFT JOIN demo_incomplets i ON dp.decalage = 0 AND i.site = s.code AND i.programme = p.code
LEFT JOIN utilisateurs g ON g.structure_id = s.id AND g.username LIKE 'demo\_gest\_%'
WHERE i.etat IS DISTINCT FROM 'ABSENT';

-- ── Mouvements des plans passés ─────────────────────────────────────────────
-- délai : jours entre la validation du plan et la réception complète par le site ;
-- motif : réception close avec un écart. La Région Démo exécute vite (4 à 12 jours),
-- la Région Démo Est lentement (19 à 35 jours) : le comparatif des délais le montre.
CREATE TEMP TABLE demo_mouvements (region TEXT, decalage INT, produit TEXT, source TEXT, cible TEXT,
                                   propose NUMERIC, execute NUMERIC, statut TEXT, delai INT, motif TEXT) ON COMMIT DROP;
INSERT INTO demo_mouvements VALUES
    ('Région Démo', 5, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-ANT', 100, 100, 'EXECUTE',  6, NULL),
    ('Région Démo', 5, 'DEMO-TDR',    'DEMO-FIA', 'DEMO-TAN',  50,  50, 'EXECUTE',  8, NULL),
    ('Région Démo', 5, 'DEMO-DMPA',   'DEMO-CHR', 'DEMO-AMB',  60,  60, 'EXECUTE',  5, NULL),
    ('Région Démo', 5, 'DEMO-OCYT',   'DEMO-ANT', 'DEMO-CHR', 120, 120, 'EXECUTE',  7, NULL),
    ('Région Démo', 5, 'DEMO-FER',    'DEMO-CHR', 'DEMO-MAH', 800, 800, 'EXECUTE', 10, NULL),
    ('Région Démo', 4, 'DEMO-ACT-EN', 'DEMO-CHR', 'DEMO-MAH',  50,  50, 'EXECUTE',  4, NULL),
    ('Région Démo', 4, 'DEMO-ART-INJ','DEMO-DEP', 'DEMO-FIA',  15,  15, 'EXECUTE',  9, NULL),
    ('Région Démo', 4, 'DEMO-COC',    'DEMO-CHR', 'DEMO-AMB',  40,  40, 'EXECUTE',  6, NULL),
    ('Région Démo', 4, 'DEMO-IMPL',   'DEMO-DEP', 'DEMO-AMB',  10,  10, 'EXECUTE',  6, NULL),
    ('Région Démo', 4, 'DEMO-FER',    'DEMO-FIA', 'DEMO-MAH', 600, 600, 'EXECUTE', 12, NULL),
    ('Région Démo', 4, 'DEMO-MGSO4',  'DEMO-FIA', 'DEMO-CHR',  30,  30, 'EXECUTE',  5, NULL),
    ('Région Démo', 3, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-MAH',  90,  90, 'EXECUTE',  7, NULL),
    ('Région Démo', 3, 'DEMO-TDR',    'DEMO-ANT', 'DEMO-TAN',  40,  40, 'EXECUTE', 11, NULL),
    ('Région Démo', 3, 'DEMO-DMPA',   'DEMO-DEP', 'DEMO-ANT',  70,  70, 'EXECUTE',  4, NULL),
    ('Région Démo', 3, 'DEMO-OCYT',   'DEMO-AMB', 'DEMO-CHR', 140, 140, 'EXECUTE',  9, NULL),
    ('Région Démo', 3, 'DEMO-FER',    'DEMO-CHR', 'DEMO-MAH', 700, 650, 'EXECUTE',  8, 'CASSE'),
    ('Région Démo', 2, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-AMB', 120, 120, 'EXECUTE',  5, NULL),
    ('Région Démo', 2, 'DEMO-TDR',    'DEMO-ANT', 'DEMO-TAN',  60,  60, 'EXECUTE',  7, NULL),
    ('Région Démo', 2, 'DEMO-DMPA',   'DEMO-DEP', 'DEMO-ANT',  80,  80, 'EXECUTE',  6, NULL),
    ('Région Démo', 2, 'DEMO-COC',    'DEMO-CHR', 'DEMO-AMB',  50,  50, 'EXECUTE',  9, NULL),
    ('Région Démo', 2, 'DEMO-OCYT',   'DEMO-AMB', 'DEMO-CHR', 150, 150, 'EXECUTE',  4, NULL),
    ('Région Démo', 2, 'DEMO-FER',    'DEMO-CHR', 'DEMO-MAH', 900, 900, 'EXECUTE', 10, NULL),
    ('Région Démo', 1, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-ANT', 120, 120, 'EXECUTE',  6, NULL),
    ('Région Démo', 1, 'DEMO-ACT-EN', 'DEMO-CHR', 'DEMO-MAH',  60,  40, 'PARTIEL', 12, NULL),
    ('Région Démo', 1, 'DEMO-TDR',    'DEMO-CHR', 'DEMO-AMB',  80,   0, 'EN_ATTENTE', NULL, NULL),
    ('Région Démo', 1, 'DEMO-DMPA',   'DEMO-DEP', 'DEMO-AMB', 100,   0, 'EN_ATTENTE', NULL, NULL),
    ('Région Démo', 1, 'DEMO-IMPL',   'DEMO-DEP', 'DEMO-CHR',  20,  20, 'EXECUTE',  8, NULL),
    ('Région Démo', 1, 'DEMO-OCYT',   'DEMO-ANT', 'DEMO-CHR', 200, 200, 'EXECUTE',  5, NULL),
    ('Région Démo', 1, 'DEMO-FER',    'DEMO-FIA', 'DEMO-MAH', 800, 800, 'EXECUTE',  9, NULL),
    ('Région Démo Est', 5, 'DEMO-ACT-AD', 'DEMO-E-CHR', 'DEMO-E-ATS',  80,  80, 'EXECUTE', 24, NULL),
    ('Région Démo Est', 5, 'DEMO-FER',    'DEMO-E-CHR', 'DEMO-E-MAV', 500, 500, 'EXECUTE', 31, NULL),
    ('Région Démo Est', 4, 'DEMO-TDR',    'DEMO-E-MAV', 'DEMO-E-ATS',  40,  40, 'EXECUTE', 28, NULL),
    ('Région Démo Est', 4, 'DEMO-DMPA',   'DEMO-E-CHR', 'DEMO-E-AMR',  50,  50, 'EXECUTE', 22, NULL),
    ('Région Démo Est', 3, 'DEMO-ACT-AD', 'DEMO-E-CHR', 'DEMO-E-ATS',  70,  70, 'EXECUTE', 35, NULL),
    ('Région Démo Est', 3, 'DEMO-OCYT',   'DEMO-E-AMR', 'DEMO-E-CHR', 100,  80, 'EXECUTE', 26, 'MANQUANT'),
    ('Région Démo Est', 2, 'DEMO-COC',    'DEMO-E-CHR', 'DEMO-E-MAV',  30,  30, 'EXECUTE', 19, NULL),
    ('Région Démo Est', 2, 'DEMO-FER',    'DEMO-E-CHR', 'DEMO-E-ATS', 400, 400, 'EXECUTE', 27, NULL),
    ('Région Démo Est', 1, 'DEMO-ACT-AD', 'DEMO-E-CHR', 'DEMO-E-ATS',  60,  30, 'PARTIEL', 20, NULL),
    ('Région Démo Est', 1, 'DEMO-OCYT',   'DEMO-E-AMR', 'DEMO-E-CHR',  90,   0, 'EN_ATTENTE', NULL, NULL),
    -- Période en cours de la Région Démo Est : un plan encore en brouillon
    ('Région Démo Est', 0, 'DEMO-ACT-AD', 'DEMO-E-CHR', 'DEMO-E-AMR',  50,   0, 'EN_ATTENTE', NULL, NULL);

-- ── Saisies ─────────────────────────────────────────────────────────────────
-- Période en cours : la situation ci-dessus (seulement les produits suivis par le site).
-- Périodes passées : même consommation, stock variable pour un historique réaliste ;
-- ruptures chroniques à 0, préservatifs en surstock chaque mois.
CREATE TEMP TABLE demo_saisies ON COMMIT DROP AS
SELECT dp.id AS periode_id, dp.decalage, s.id AS structure_id, pr.id AS produit_id, e.id AS etat_id, e.saisi_par,
       CASE WHEN dp.decalage = 0 THEN m.stock
            WHEN EXISTS (SELECT 1 FROM demo_chroniques c WHERE c.site = m.site AND c.produit = m.produit) THEN 0
            WHEN m.produit = 'DEMO-PRES' THEN CASE WHEN m.cmm = 0 THEN m.stock ELSE ROUND(m.cmm * 6) END
            -- Mois passés : les destinataires des plans étaient en rupture ou en tension,
            -- les sites expéditeurs avaient de quoi céder ; les autres varient
            WHEN EXISTS (SELECT 1 FROM demo_mouvements mv WHERE mv.decalage = dp.decalage
                         AND mv.cible = m.site AND mv.produit = m.produit)
                 THEN CASE WHEN abs(hashtext(s.code || pr.code)) % 2 = 0 THEN 0 ELSE ROUND(m.cmm * 0.4) END
            WHEN EXISTS (SELECT 1 FROM demo_mouvements mv WHERE mv.decalage = dp.decalage
                         AND mv.source = m.site AND mv.produit = m.produit)
                 THEN GREATEST(ROUND(m.cmm * 5.5), m.stock)
            ELSE ROUND(m.cmm * ((abs(hashtext(s.code || pr.code || dp.decalage)) % 55) / 10.0 + 0.4))
                 + CASE WHEN m.cmm = 0 THEN m.stock ELSE 0 END END AS stock,
       m.cmm,
       CASE WHEN dp.decalage = 0 THEN CASE WHEN m.jours IS NULL THEN NULL ELSE CURRENT_DATE + m.jours END
            ELSE dp.date_ras + (180 + abs(hashtext(pr.code || s.code)) % 360) END AS expire_date,
       dp.date_ras + INTERVAL '3 days' AS date_saisie
FROM demo_situation m
JOIN structures s ON s.code = m.site
JOIN produits pr ON pr.code = m.produit
JOIN structure_programme_produit spp ON spp.structure_id = s.id AND spp.produit_id = pr.id AND spp.actif
JOIN districts di ON di.id = s.district_id
JOIN demo_periodes dp ON dp.region_id = di.region_id
JOIN etats_stock e ON e.periode_id = dp.id AND e.structure_id = s.id AND e.programme_id = pr.programme_id;

INSERT INTO saisies_stock (periode_id, structure_id, produit_id, etat_id, stock_disponible, cmm, stock_securite,
                           msd, expire_date, statut_stock, date_saisie, saisi_par, source, ignored)
SELECT d.periode_id, d.structure_id, d.produit_id, d.etat_id, d.stock, d.cmm,
       CASE WHEN d.cmm > 0 THEN d.cmm END,
       CASE WHEN d.cmm > 0 THEN ROUND(d.stock / d.cmm, 2) ELSE 0 END,
       CASE WHEN d.stock > 0 THEN d.expire_date END,
       CASE WHEN d.cmm IS NULL OR d.cmm <= 0 THEN CASE WHEN d.stock = 0 THEN 'RUPTURE' ELSE 'STOCK_DORMANT' END
            WHEN ROUND(d.stock / d.cmm, 2) = 0 THEN 'RUPTURE'
            WHEN ROUND(d.stock / d.cmm, 2) <  t.seuil_tension    THEN 'TENSION'
            WHEN ROUND(d.stock / d.cmm, 2) <  t.seuil_surveiller THEN 'SURVEILLER'
            WHEN ROUND(d.stock / d.cmm, 2) <= t.seuil_surstock   THEN 'BIEN_STOCKE'
            ELSE 'SURSTOCK' END,
       d.date_saisie, d.saisi_par, 'MANUEL', FALSE
FROM demo_saisies d CROSS JOIN parametres_statut t;

-- ── Plans ───────────────────────────────────────────────────────────────────
-- Un plan par région, période et programme ayant des mouvements : clôturé si tout est
-- reçu, validé sinon ; la période en cours de la Région Démo Est a un brouillon.
-- Validé 9 jours après la date RAS. Un plan est marqué « généré par l'IA », avec son résumé.
INSERT INTO plans_reattribution (periode_id, programme_id, region_id, statut, genere_par_ia, resume_ia,
                                 date_generation, date_validation, valide_par, date_cloture, notes, created_at)
SELECT dp.id, p.id, dp.region_id,
       CASE WHEN g.decalage = 0 THEN 'BROUILLON' WHEN g.tout_recu THEN 'CLOTURE' ELSE 'VALIDE' END,
       (g.region = 'Région Démo' AND g.decalage = 3 AND g.programme = 'DEMO-PALU'),
       CASE WHEN g.region = 'Région Démo' AND g.decalage = 3 AND g.programme = 'DEMO-PALU'
            THEN 'Plan proposé par l''analyse IA (exemple du jeu de démonstration) : l''hôpital en surstock '
              || 'alimente Mahasoa en ASAQ adulte, Antsahabe cède ses TDR à Tanambao en rupture.' END,
       LEAST(dp.date_ras + INTERVAL '8 days', NOW() - INTERVAL '1 day'),
       CASE WHEN g.decalage > 0 THEN dp.date_ras + INTERVAL '9 days' END,
       CASE WHEN g.decalage > 0 THEN (SELECT id FROM utilisateurs WHERE region_id = dp.region_id AND username LIKE 'demo\_pharmacien%') END,
       CASE WHEN g.decalage > 0 AND g.tout_recu
            THEN LEAST(dp.date_ras + INTERVAL '9 days' + make_interval(days => g.delai_max), NOW()) END,
       'Plan du jeu de démonstration', LEAST(dp.date_ras + INTERVAL '8 days', NOW() - INTERVAL '1 day')
FROM (SELECT region, decalage, pr.programme, bool_and(statut = 'EXECUTE') AS tout_recu, COALESCE(MAX(delai), 0) AS delai_max
      FROM demo_mouvements m JOIN (SELECT p2.code AS produit, pg.code AS programme FROM produits p2 JOIN programmes pg ON pg.id = p2.programme_id) pr
        ON pr.produit = m.produit
      GROUP BY region, decalage, pr.programme) g
JOIN demo_periodes dp ON dp.region = g.region AND dp.decalage = g.decalage
JOIN programmes p ON p.code = g.programme;

INSERT INTO lignes_plan (plan_id, produit_id, structure_source_id, structure_cible_id, quantite_proposee,
                         quantite_executee, statut, date_execution, date_reception, motif_ecart, notes, expire_date, created_at)
SELECT pl.id, pr.id, src.id, cib.id, m.propose, m.execute, m.statut,
       CASE WHEN m.execute > 0 THEN LEAST(dp.date_ras + INTERVAL '9 days' + make_interval(days => m.delai), NOW()) END,
       CASE WHEN m.execute > 0 THEN LEAST(dp.date_ras + 9 + m.delai, CURRENT_DATE) END,
       m.motif,
       CASE m.statut WHEN 'PARTIEL' THEN 'Livraison partielle : véhicule indisponible' END,
       dp.date_ras + INTERVAL '300 days',
       -- créées il y a plus de 14 jours : les lignes en attente déclenchent l'alerte de retard
       CASE WHEN m.decalage = 0 THEN NOW() - INTERVAL '1 day'
            ELSE LEAST(dp.date_ras + INTERVAL '8 days', NOW() - INTERVAL '15 days') END
FROM demo_mouvements m
JOIN demo_periodes dp ON dp.region = m.region AND dp.decalage = m.decalage
JOIN produits pr ON pr.code = m.produit
JOIN plans_reattribution pl ON pl.periode_id = dp.id AND pl.programme_id = pr.programme_id
JOIN structures src ON src.code = m.source
JOIN structures cib ON cib.code = m.cible;

-- ── Réceptions confirmées par les sites destinataires ──────────────────────
-- Une réception par mouvement reçu ; les grosses livraisons (500 et plus) arrivent en
-- deux fois (60 % quatre jours avant le reste). L'écart éventuel est porté par la dernière.
INSERT INTO receptions_ligne (ligne_plan_id, quantite, date_reception, motif_ecart, notes, saisi_par, created_at)
SELECT l.id, v.quantite, v.jour, v.motif, v.notes,
       COALESCE((SELECT username FROM utilisateurs WHERE structure_id = l.structure_cible_id AND username LIKE 'demo\_gest\_%' LIMIT 1), 'demo_pharmacien'),
       v.jour + TIME '10:00'
FROM lignes_plan l
JOIN plans_reattribution pl ON pl.id = l.plan_id
JOIN produits pr ON pr.id = l.produit_id AND pr.code LIKE 'DEMO-%'
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        (CASE WHEN l.quantite_executee >= 500 THEN ROUND(l.quantite_executee * 0.6) ELSE l.quantite_executee END,
         CASE WHEN l.quantite_executee >= 500 THEN GREATEST(pl.date_validation::date + 1, l.date_reception - 4) ELSE l.date_reception END,
         CASE WHEN l.quantite_executee >= 500 THEN NULL ELSE l.motif_ecart END,
         CASE WHEN l.quantite_executee >= 500 THEN 'Premier arrivage' END),
        (CASE WHEN l.quantite_executee >= 500 THEN l.quantite_executee - ROUND(l.quantite_executee * 0.6) END,
         l.date_reception, l.motif_ecart,
         CASE WHEN l.motif_ecart = 'CASSE' THEN 'Cartons écrasés pendant le transport'
              WHEN l.motif_ecart = 'MANQUANT' THEN 'Colis incomplet à la livraison' END)
    ) r(quantite, jour, motif, notes)
    WHERE r.quantite IS NOT NULL AND r.quantite > 0
) v
WHERE l.quantite_executee > 0;

-- ── Notifications ───────────────────────────────────────────────────────────
-- Transferts à réaliser (sites sources), réceptions attendues (sites destinataires),
-- réceptions confirmées (pharmaciens), relances de saisie dont une déjà lue
INSERT INTO notifications (plan_id, ligne_plan_id, type, message, destinataire_id, lu, date_envoi)
SELECT l.plan_id, l.id, 'RAPPEL_EXECUTION',
       'Transfert à réaliser : ' || pr.nom || ' vers ' || cib.nom || ' (' || l.quantite_proposee::int || ')',
       g.id, FALSE, NOW() - INTERVAL '10 days'
FROM lignes_plan l
JOIN plans_reattribution pl ON pl.id = l.plan_id AND pl.statut = 'VALIDE'
JOIN produits pr ON pr.id = l.produit_id
JOIN structures cib ON cib.id = l.structure_cible_id
JOIN utilisateurs g ON g.structure_id = l.structure_source_id AND g.username LIKE 'demo\_gest\_%'
WHERE pr.code LIKE 'DEMO-%' AND l.statut IN ('EN_ATTENTE', 'PARTIEL');

INSERT INTO notifications (plan_id, ligne_plan_id, type, message, destinataire_id, lu, date_envoi)
SELECT l.plan_id, l.id, 'RECEPTION_ATTENDUE',
       'Le plan ' || pl.id || ' a été validé : ' || src.nom || ' doit vous livrer ' || l.quantite_proposee::int || ' '
         || pr.unite || ' de ' || pr.nom || '. À l''arrivée, confirmez la réception dans Suivi des plans.',
       g.id, FALSE, pl.date_validation
FROM lignes_plan l
JOIN plans_reattribution pl ON pl.id = l.plan_id AND pl.statut = 'VALIDE'
JOIN produits pr ON pr.id = l.produit_id
JOIN structures src ON src.id = l.structure_source_id
JOIN utilisateurs g ON g.structure_id = l.structure_cible_id AND g.username LIKE 'demo\_gest\_%'
WHERE pr.code LIKE 'DEMO-%' AND l.statut IN ('EN_ATTENTE', 'PARTIEL');

INSERT INTO notifications (plan_id, ligne_plan_id, type, message, destinataire_id, lu, date_envoi)
SELECT l.plan_id, l.id, 'RECEPTION',
       cib.nom || ' a reçu ' || r.quantite::int || ' ' || pr.unite || ' de ' || pr.nom || ' (plan ' || pl.id || ') : '
         || l.quantite_executee::int || ' sur ' || l.quantite_proposee::int || ' reçus.',
       ph.id, FALSE, r.created_at
FROM receptions_ligne r
JOIN lignes_plan l ON l.id = r.ligne_plan_id
JOIN plans_reattribution pl ON pl.id = l.plan_id
JOIN demo_periodes dp ON dp.id = pl.periode_id AND dp.decalage = 1
JOIN produits pr ON pr.id = l.produit_id
JOIN structures cib ON cib.id = l.structure_cible_id
JOIN utilisateurs ph ON ph.region_id = pl.region_id AND ph.username LIKE 'demo\_pharmacien%';

INSERT INTO notifications (type, message, destinataire_id, lu, date_envoi)
SELECT 'RELANCE_SAISIE',
       'Rappel: veuillez saisir l''état de stock pour la période '
         || to_char(date_trunc('month', CURRENT_DATE), 'DD/MM/YYYY') || ' / programme ' || p.nom,
       u.id, v.lu, NOW() - v.age
FROM (VALUES ('demo_gest_ank', 'DEMO-SMI',  FALSE, INTERVAL '2 days'),
             ('demo_gest_tan', 'DEMO-PF',   FALSE, INTERVAL '1 day'),
             ('demo_gest_amb', 'DEMO-PALU', TRUE,  INTERVAL '40 days')) v(username, programme, lu, age)
JOIN utilisateurs u ON u.username = v.username
JOIN programmes p ON p.code = v.programme;

-- ── Bilan ───────────────────────────────────────────────────────────────────
SELECT 'régions' AS element, COUNT(*) AS nombre FROM regions WHERE nom LIKE 'Région Démo%'
UNION ALL SELECT 'sites', COUNT(*) FROM structures WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'produits', COUNT(*) FROM produits WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'comptes', COUNT(*) FROM utilisateurs WHERE username LIKE 'demo\_%'
UNION ALL SELECT 'périodes', COUNT(*) FROM demo_periodes
UNION ALL SELECT 'états de stock', COUNT(*) FROM etats_stock WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'saisies', COUNT(*) FROM saisies_stock WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'plans', COUNT(*) FROM plans_reattribution WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'mouvements', COUNT(*) FROM lignes_plan WHERE plan_id IN
    (SELECT id FROM plans_reattribution WHERE periode_id IN (SELECT id FROM demo_periodes))
UNION ALL SELECT 'réceptions', COUNT(*) FROM receptions_ligne WHERE ligne_plan_id IN
    (SELECT l.id FROM lignes_plan l JOIN plans_reattribution p ON p.id = l.plan_id WHERE p.periode_id IN (SELECT id FROM demo_periodes))
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications WHERE destinataire_id IN
    (SELECT id FROM utilisateurs WHERE username LIKE 'demo\_%');
