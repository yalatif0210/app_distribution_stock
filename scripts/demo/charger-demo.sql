-- ════════════════════════════════════════════════════════════════════════════
-- Jeu de démonstration complet : « Région Démo »
--
-- Charge une région fictive pour tester l'application de bout en bout :
--   • 3 districts, 9 sites (dont 1 inactif), 3 programmes DEMO-*, 13 produits ;
--   • 10 comptes demo_* (mot de passe Admin@2024) : pharmacien, superviseur, gestionnaires ;
--   • 3 périodes : M-2 et M-1 fermées avec historique et plans, M ouverte à traiter ;
--   • sur la période en cours, tous les cas de figure (voir README.md à côté).
--
-- Les dates sont calculées depuis la date du jour : le jeu reste valable dans le temps.
-- Rejouable : le jeu existant est d'abord supprimé (supprimer-demo.sql).
-- À NE PAS charger en production.
-- ════════════════════════════════════════════════════════════════════════════

\ir supprimer-demo.sql

-- ── Référentiel ─────────────────────────────────────────────────────────────
INSERT INTO regions (nom, seuil_stock_securite_msd) VALUES ('Région Démo', 2.0);

INSERT INTO districts (nom, region_id)
SELECT d, (SELECT id FROM regions WHERE nom = 'Région Démo')
FROM (VALUES ('District Démo Nord'), ('District Démo Centre'), ('District Démo Sud')) v(d);

INSERT INTO structures (code, nom, type, district_id, active)
SELECT v.code, v.nom, v.type, d.id, v.active
FROM (VALUES
    ('DEMO-CHR', 'Centre hospitalier régional Démo', 'HOPITAL',      'District Démo Centre', TRUE),
    ('DEMO-DEP', 'Dépôt régional Démo',              'DEPOT',        'District Démo Centre', TRUE),
    ('DEMO-FIA', 'CSB Fiadanana',                    'CENTRE_SANTE', 'District Démo Centre', TRUE),
    ('DEMO-AMB', 'CSB Ambatomena',                   'CENTRE_SANTE', 'District Démo Nord',   TRUE),
    ('DEMO-ANT', 'CSB Antsahabe',                    'CENTRE_SANTE', 'District Démo Nord',   TRUE),
    ('DEMO-VOH', 'CSB Vohitra (fermé)',              'CENTRE_SANTE', 'District Démo Nord',   FALSE),
    ('DEMO-MAH', 'CSB Mahasoa',                      'CENTRE_SANTE', 'District Démo Sud',    TRUE),
    ('DEMO-TAN', 'CSB Tanambao',                     'CENTRE_SANTE', 'District Démo Sud',    TRUE),
    ('DEMO-ANK', 'Dispensaire Ankadibe',             'DISPENSAIRE',  'District Démo Sud',    TRUE)
) v(code, nom, type, district, active)
JOIN districts d ON d.nom = v.district AND d.region_id = (SELECT id FROM regions WHERE nom = 'Région Démo');

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
         OR (s.code IN ('DEMO-ANT', 'DEMO-MAH', 'DEMO-TAN', 'DEMO-ANK') AND pr.code = 'DEMO-IMPL')
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
       CASE WHEN v.role = 'PHARMACIEN_REGION' THEN (SELECT id FROM regions WHERE nom = 'Région Démo') END,
       TRUE
FROM (VALUES
    ('demo_pharmacien', 'Rakoto',      'Hanta',   'PHARMACIEN_REGION', NULL),
    ('demo_superviseur','Andria',      'Faly',    'SUPERVISEUR',       NULL),
    ('demo_gest_chr',   'Rabe',        'Soa',     'GESTIONNAIRE',      'DEMO-CHR'),
    ('demo_gest_dep',   'Randria',     'Tiana',   'GESTIONNAIRE',      'DEMO-DEP'),
    ('demo_gest_fia',   'Razafy',      'Lova',    'GESTIONNAIRE',      'DEMO-FIA'),
    ('demo_gest_amb',   'Rasoa',       'Mamy',    'GESTIONNAIRE',      'DEMO-AMB'),
    ('demo_gest_ant',   'Ranaivo',     'Nirina',  'GESTIONNAIRE',      'DEMO-ANT'),
    ('demo_gest_mah',   'Rajao',       'Fara',    'GESTIONNAIRE',      'DEMO-MAH'),
    ('demo_gest_tan',   'Rasolo',      'Haja',    'GESTIONNAIRE',      'DEMO-TAN'),
    ('demo_gest_ank',   'Ravelo',      'Voahangy','GESTIONNAIRE',      'DEMO-ANK')
) v(username, nom, prenom, role, site)
JOIN roles r ON r.name = v.role;

-- Le superviseur couvre la Région Démo et la première région existante (cas multi-régions)
INSERT INTO superviseur_regions (utilisateur_id, region_id)
SELECT u.id, r.id FROM utilisateurs u
JOIN regions r ON r.nom = 'Région Démo' OR r.id = (SELECT MIN(id) FROM regions WHERE nom <> 'Région Démo')
WHERE u.username = 'demo_superviseur';

-- ── Périodes : M-2 et M-1 fermées, M ouverte ────────────────────────────────
INSERT INTO periodes_saisie (annee, mois, date_ras, statut, region_id, cree_par, created_at)
SELECT EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, d, v.statut,
       (SELECT id FROM regions WHERE nom = 'Région Démo'),
       (SELECT id FROM utilisateurs WHERE username = 'demo_pharmacien'), d
FROM (VALUES (2, 'FERMEE'), (1, 'FERMEE'), (0, 'OUVERTE')) v(decalage, statut),
LATERAL (SELECT (date_trunc('month', CURRENT_DATE) - make_interval(months => v.decalage))::date AS d) x;

CREATE TEMP TABLE demo_periodes ON COMMIT DROP AS
SELECT p.id, (EXTRACT(YEAR FROM age(date_trunc('month', CURRENT_DATE), p.date_ras)) * 12
            + EXTRACT(MONTH FROM age(date_trunc('month', CURRENT_DATE), p.date_ras)))::int AS decalage, p.date_ras
FROM periodes_saisie p WHERE p.region_id = (SELECT id FROM regions WHERE nom = 'Région Démo');

-- ── Période en cours : situation de chaque site, produit par produit ────────
-- stock, CMM, jours avant péremption du lot (NULL si stock nul).
-- Seuil de sécurité de la région : 2 mois. Statuts : tension < 1, à surveiller < 2,
-- bien stocké ≤ 4, surstock au-delà.
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
    -- TDR : des sites en tension mais AUCUNE source (diagnostic affiché)
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
    -- Préservatifs : surstock partout, aucune tension
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
    -- Fer : grandes quantités
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

-- ── États de stock ──────────────────────────────────────────────────────────
-- Périodes passées : tout est soumis. Période en cours : complétude partielle
--   • Dispensaire Ankadibe : paludisme en cours de saisie, santé maternelle pas commencée ;
--   • CSB Tanambao : planification familiale en cours de saisie (non soumise).
INSERT INTO etats_stock (periode_id, structure_id, programme_id, statut, saisi_par, soumis_par, date_creation, date_soumission)
SELECT dp.id, sp.structure_id, sp.programme_id,
       CASE WHEN dp.decalage = 0 AND ((s.code = 'DEMO-ANK' AND p.code = 'DEMO-PALU')
                                   OR (s.code = 'DEMO-TAN' AND p.code = 'DEMO-PF'))
            THEN 'SUGGESTED' ELSE 'SUBMITTED' END,
       g.id,
       CASE WHEN dp.decalage = 0 AND ((s.code = 'DEMO-ANK' AND p.code = 'DEMO-PALU')
                                   OR (s.code = 'DEMO-TAN' AND p.code = 'DEMO-PF'))
            THEN NULL ELSE g.id END,
       dp.date_ras + INTERVAL '2 days',
       CASE WHEN dp.decalage = 0 AND ((s.code = 'DEMO-ANK' AND p.code = 'DEMO-PALU')
                                   OR (s.code = 'DEMO-TAN' AND p.code = 'DEMO-PF'))
            THEN NULL ELSE LEAST(dp.date_ras + INTERVAL '5 days', NOW() - INTERVAL '1 hour') END
FROM demo_periodes dp
CROSS JOIN structure_programme sp
JOIN structures s ON s.id = sp.structure_id AND s.code LIKE 'DEMO-%'
JOIN programmes p ON p.id = sp.programme_id
LEFT JOIN utilisateurs g ON g.structure_id = s.id AND g.username LIKE 'demo\_gest\_%'
WHERE NOT (dp.decalage = 0 AND s.code = 'DEMO-ANK' AND p.code = 'DEMO-SMI');

-- ── Saisies ─────────────────────────────────────────────────────────────────
-- Période en cours : la situation ci-dessus (seulement les produits suivis par le site)
-- Périodes passées : même consommation, stock variable pour un historique réaliste.
CREATE TEMP TABLE demo_saisies ON COMMIT DROP AS
SELECT dp.id AS periode_id, dp.decalage, s.id AS structure_id, pr.id AS produit_id, e.id AS etat_id, e.saisi_par,
       CASE WHEN dp.decalage = 0 THEN m.stock
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
CROSS JOIN demo_periodes dp
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

-- ── Plans des périodes passées ──────────────────────────────────────────────
-- M-2 : les trois programmes clôturés. M-1 : paludisme et PF validés, en cours
-- d'exécution (avec des retards), santé maternelle clôturée.
CREATE TEMP TABLE demo_plans (decalage INT, programme TEXT, statut TEXT) ON COMMIT DROP;
INSERT INTO demo_plans VALUES
    (2, 'DEMO-PALU', 'CLOTURE'), (2, 'DEMO-PF', 'CLOTURE'), (2, 'DEMO-SMI', 'CLOTURE'),
    (1, 'DEMO-PALU', 'VALIDE'),  (1, 'DEMO-PF', 'VALIDE'),  (1, 'DEMO-SMI', 'CLOTURE');

INSERT INTO plans_reattribution (periode_id, programme_id, region_id, statut, genere_par_ia, date_generation,
                                 date_validation, valide_par, date_cloture, notes, created_at)
SELECT dp.id, p.id, (SELECT id FROM regions WHERE nom = 'Région Démo'), v.statut, FALSE,
       dp.date_ras + INTERVAL '8 days', dp.date_ras + INTERVAL '9 days',
       (SELECT id FROM utilisateurs WHERE username = 'demo_pharmacien'),
       CASE WHEN v.statut = 'CLOTURE' THEN dp.date_ras + INTERVAL '25 days' END,
       'Plan du jeu de démonstration', dp.date_ras + INTERVAL '8 days'
FROM demo_plans v
JOIN demo_periodes dp ON dp.decalage = v.decalage
JOIN programmes p ON p.code = v.programme;

CREATE TEMP TABLE demo_mouvements (decalage INT, produit TEXT, source TEXT, cible TEXT,
                                   propose NUMERIC, execute NUMERIC, statut TEXT) ON COMMIT DROP;
INSERT INTO demo_mouvements VALUES
    (2, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-AMB', 120, 120, 'EXECUTE'),
    (2, 'DEMO-TDR',    'DEMO-ANT', 'DEMO-TAN',  60,  60, 'EXECUTE'),
    (2, 'DEMO-DMPA',   'DEMO-DEP', 'DEMO-ANT',  80,  80, 'EXECUTE'),
    (2, 'DEMO-COC',    'DEMO-CHR', 'DEMO-AMB',  50,  50, 'EXECUTE'),
    (2, 'DEMO-OCYT',   'DEMO-AMB', 'DEMO-CHR', 150, 150, 'EXECUTE'),
    (2, 'DEMO-FER',    'DEMO-CHR', 'DEMO-MAH', 900, 900, 'EXECUTE'),
    (1, 'DEMO-ACT-AD', 'DEMO-CHR', 'DEMO-ANT', 120, 120, 'EXECUTE'),
    (1, 'DEMO-ACT-EN', 'DEMO-CHR', 'DEMO-MAH',  60,  40, 'PARTIEL'),
    (1, 'DEMO-TDR',    'DEMO-CHR', 'DEMO-AMB',  80,   0, 'EN_ATTENTE'),
    (1, 'DEMO-DMPA',   'DEMO-DEP', 'DEMO-AMB', 100,   0, 'EN_ATTENTE'),
    (1, 'DEMO-IMPL',   'DEMO-DEP', 'DEMO-CHR',  20,  20, 'EXECUTE'),
    (1, 'DEMO-OCYT',   'DEMO-ANT', 'DEMO-CHR', 200, 200, 'EXECUTE'),
    (1, 'DEMO-FER',    'DEMO-FIA', 'DEMO-MAH', 800, 800, 'EXECUTE');

INSERT INTO lignes_plan (plan_id, produit_id, structure_source_id, structure_cible_id, quantite_proposee,
                         quantite_executee, statut, date_execution, notes, expire_date, created_at)
SELECT pl.id, pr.id, src.id, cib.id, m.propose, m.execute, m.statut,
       CASE WHEN m.execute > 0 THEN dp.date_ras + INTERVAL '15 days' END,
       CASE m.statut WHEN 'PARTIEL' THEN 'Livraison partielle : véhicule indisponible' END,
       dp.date_ras + INTERVAL '300 days',
       -- créées il y a plus de 14 jours : les lignes en attente déclenchent l'alerte de retard
       LEAST(dp.date_ras + INTERVAL '8 days', NOW() - INTERVAL '15 days')
FROM demo_mouvements m
JOIN demo_periodes dp ON dp.decalage = m.decalage
JOIN produits pr ON pr.code = m.produit
JOIN plans_reattribution pl ON pl.periode_id = dp.id AND pl.programme_id = pr.programme_id
JOIN structures src ON src.code = m.source
JOIN structures cib ON cib.code = m.cible;

-- ── Notifications ───────────────────────────────────────────────────────────
-- Plan validé en attente d'exécution, relance de saisie, une notification déjà lue
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
SELECT 'sites' AS element, COUNT(*) AS nombre FROM structures WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'produits', COUNT(*) FROM produits WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'comptes', COUNT(*) FROM utilisateurs WHERE username LIKE 'demo\_%'
UNION ALL SELECT 'périodes', COUNT(*) FROM demo_periodes
UNION ALL SELECT 'états de stock', COUNT(*) FROM etats_stock WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'saisies', COUNT(*) FROM saisies_stock WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'plans', COUNT(*) FROM plans_reattribution WHERE periode_id IN (SELECT id FROM demo_periodes)
UNION ALL SELECT 'mouvements', COUNT(*) FROM lignes_plan WHERE plan_id IN
    (SELECT id FROM plans_reattribution WHERE periode_id IN (SELECT id FROM demo_periodes))
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications WHERE destinataire_id IN
    (SELECT id FROM utilisateurs WHERE username LIKE 'demo\_%');
