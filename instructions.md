# Plan de développement — Outil de Redistribution Intelligente de Stocks Sanitaires

## Contexte du projet

Développer un outil web permettant aux gestionnaires en pharmacie et aux pharmaciens de région de gérer et optimiser la redistribution des stocks médicaux entre structures sanitaires d'une même région. L'outil analyse périodiquement les niveaux de stock, identifie les tensions et surstocks, et propose des plans de réattribution validables et suivables.

---

## Stack technique

- **Frontend** : Angular 17+ (standalone components, **PrimeNG avec thème Poseidon** — https://poseidon.primeng.org/)
- **Backend** : Spring Boot 3.x (Java 17+, Spring Data JPA, Spring Security)
- **Base de données** : PostgreSQL 15+
- **IA** : Claude API (Anthropic) — modèle `claude-sonnet-4-20250514`
- **Import Excel** : Apache POI (côté backend)
- **Authentification** : JWT (Spring Security + jjwt)
- **Planificateur** : Spring `@Scheduled` pour les rappels de suivi

---

## Architecture générale

```
[Angular Frontend]
        │
        │ HTTP REST (JSON)
        ▼
[Spring Boot Backend]
    ├── Controllers REST
    ├── Services métier
    ├── Moteur d'analyse (règles supply chain)
    ├── Service IA (Claude API)
    ├── Scheduler (rappels)
    └── Repository JPA
        │
        ▼
[PostgreSQL]
```

---

## Rôles et périmètres fonctionnels

### GESTIONNAIRE (gestionnaire en pharmacie)
- Saisie les états de stock pour **sa propre structure uniquement**
- Consulte l'historique des états de stock saisis pour sa structure
- Ne voit pas l'interface de génération de plans
- Peut consulter (lecture seule) les plans générés par le pharmacien de région et leur niveau d'exécution

### PHARMACIEN_REGION (pharmacien de région)
- Consulte en lecture tous les états de stock de toutes les structures de sa région
- Consulte la **complétude des saisies** : pour une période et un programme donnés, nombre de structures ayant transmis un état vs. nombre attendu
- Consulte la liste des sites n'ayant pas transmis d'état et peut les **relancer** (notification)
- **Configure l'activité des structures par programme** : définit quelles structures sont actives sur quel(s) programme(s)
- Accède à l'interface de **génération des plans de réattribution**
- Consulte et suit les plans générés (tableau de bord analytique avant/après)

### ADMIN
- Accès en lecture à toutes les régions (même visuel que le pharmacien de région, toutes régions confondues)
- **Ne peut pas** générer de plan de réattribution
- Gère le référentiel (structures, produits, programmes, utilisateurs)

---

## Modèle de données (PostgreSQL)

### Tables principales

```sql
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
    type VARCHAR(50), -- DISTRICT, HOPITAL, CENTRE_SANTE, etc.
    district_id BIGINT REFERENCES districts(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Programmes de santé
CREATE TABLE programmes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL, -- ex: PNLS, PNLP, SSR, etc.
    description TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- Liaison structures ↔ programmes (une structure peut être active sur un ou plusieurs programmes)
-- Configurée par le pharmacien de région
CREATE TABLE structure_programme (
    id BIGSERIAL PRIMARY KEY,
    structure_id BIGINT REFERENCES structures(id) ON DELETE CASCADE,
    programme_id BIGINT REFERENCES programmes(id) ON DELETE CASCADE,
    actif BOOLEAN DEFAULT TRUE,
    configure_par BIGINT REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (structure_id, programme_id)
);

-- Produits / médicaments
CREATE TABLE produits (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(200) NOT NULL,
    unite VARCHAR(20) NOT NULL, -- comprimé, flacon, sachet, etc.
    programme_id BIGINT REFERENCES programmes(id),
    actif BOOLEAN DEFAULT TRUE
);

-- Périodes de saisie
-- Chaque période appartient à une région (portée par le pharmacien de région)
-- date_ras = date prévue de la rencontre d'analyse de stock
-- annee et mois sont déduits automatiquement de date_ras à l'insertion côté backend
-- Cycle de vie : OUVERTE → FERMEE (auto après génération de tous les plans de tous les programmes de la région)
-- Le pharmacien de région peut rouvrir une période FERMEE → OUVERTE manuellement
CREATE TABLE periodes_saisie (
    id BIGSERIAL PRIMARY KEY,
    region_id BIGINT REFERENCES regions(id) NOT NULL,  -- période propre à une région
    annee INTEGER NOT NULL,        -- déduit de date_ras
    mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12), -- déduit de date_ras
    date_ras DATE NOT NULL,        -- date de la rencontre d'analyse de stock
    statut VARCHAR(20) DEFAULT 'OUVERTE', -- OUVERTE, FERMEE
    cree_par BIGINT REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (region_id, date_ras)   -- une seule période par date RAS par région
);

-- Saisies de stock (une ligne par structure/produit/période)
CREATE TABLE saisies_stock (
    id BIGSERIAL PRIMARY KEY,
    periode_id BIGINT REFERENCES periodes_saisie(id),
    structure_id BIGINT REFERENCES structures(id),
    produit_id BIGINT REFERENCES produits(id),
    stock_disponible DECIMAL(12,2) NOT NULL DEFAULT 0,
    cmm DECIMAL(12,2),              -- Consommation Mensuelle Moyenne
    stock_securite DECIMAL(12,2),   -- calculé = CMM * seuil_securite
    msd DECIMAL(8,2),               -- Mois de Stock Disponible = stock_disponible / CMM
    expire_date DATE NOT NULL,      -- Date de Péremption
    statut_stock VARCHAR(20),       -- RUPTURE, TENSION, SURVEILLER, NORMAL, SURSTOCK
    date_saisie TIMESTAMP DEFAULT NOW(),
    saisi_par BIGINT REFERENCES utilisateurs(id),
    source VARCHAR(20) DEFAULT 'MANUEL', -- MANUEL, EXCEL
    UNIQUE (periode_id, structure_id, produit_id)
);

-- Plans de réattribution
CREATE TABLE plans_reattribution (
    id BIGSERIAL PRIMARY KEY,
    periode_id BIGINT REFERENCES periodes_saisie(id),
    programme_id BIGINT REFERENCES programmes(id),
    region_id BIGINT REFERENCES regions(id),
    statut VARCHAR(30) DEFAULT 'BROUILLON', -- BROUILLON, VALIDE, EN_COURS, CLOTURE
    genere_par_ia BOOLEAN DEFAULT FALSE,
    resume_ia TEXT,                 -- justification narrative générée par Claude
    date_generation TIMESTAMP DEFAULT NOW(),
    date_validation TIMESTAMP,
    valide_par BIGINT REFERENCES utilisateurs(id),
    date_cloture TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lignes de plan (mouvements de stock)
CREATE TABLE lignes_plan (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES plans_reattribution(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    structure_source_id BIGINT REFERENCES structures(id),
    structure_cible_id BIGINT REFERENCES structures(id),
    quantite_proposee DECIMAL(12,2) NOT NULL,
    quantite_executee DECIMAL(12,2) DEFAULT 0,
    statut VARCHAR(30) DEFAULT 'EN_ATTENTE', -- EN_ATTENTE, CONFIRME, PARTIEL, EXECUTE, ANNULE
    date_execution TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Roles des utilisateurs
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL -- ADMIN, PHARMACIEN_REGION, GESTIONNAIRE
);

-- Utilisateurs
CREATE TABLE utilisateurs (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    email VARCHAR(150),
    role_id BIGINT REFERENCES roles(id),
    structure_id BIGINT REFERENCES structures(id), -- pour GESTIONNAIRE
    region_id BIGINT REFERENCES regions(id),       -- pour PHARMACIEN_REGION
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Historique des notifications / rappels
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES plans_reattribution(id),
    ligne_plan_id BIGINT REFERENCES lignes_plan(id),
    type VARCHAR(50), -- RAPPEL_EXECUTION, ALERTE_RETARD, RELANCE_SAISIE, etc.
    message TEXT,
    destinataire_id BIGINT REFERENCES utilisateurs(id),
    lu BOOLEAN DEFAULT FALSE,
    date_envoi TIMESTAMP DEFAULT NOW()
);
```

### Règles métier — seuils de stock

```
MSD (Mois de Stock Disponible) = stock_disponible / CMM

Statuts :
- RUPTURE    : MSD = 0
- TENSION    : 0 < MSD < 1
- SURVEILLER : 1 <= MSD < 2
- NORMAL     : 2 <= MSD <= 4
- SURSTOCK   : MSD > 4

Stock de sécurité par défaut = CMM * 1 mois
```

---

## Phase 1 — Fondations backend (Spring Boot + PostgreSQL)

### 1.1 Structure du projet Spring Boot

```
src/main/java/org/lhspla/redistribution/
├── config/
│   ├── SecurityConfig.java         # JWT + CORS
│   ├── JwtConfig.java
│   └── ClaudeApiConfig.java        # Clé API Claude
├── entity/
│   ├── Region.java
│   ├── District.java
│   ├── Structure.java
│   ├── Programme.java
│   ├── StructureProgramme.java
│   ├── Produit.java
│   ├── PeriodeSaisie.java
│   ├── SaisieStock.java
│   ├── PlanReattribution.java
│   ├── LignePlan.java
│   ├── Role.java
│   ├── Utilisateur.java
│   └── Notification.java
├── repository/
│   └── (un repository JPA par entité)
├── service/
│   ├── AnalyseStockService.java    # Calcul MSD, détection tensions/surstocks
│   ├── ComplétudeSaisieService.java # Complétude des saisies par structure/programme
│   ├── PlanReattributionService.java
│   ├── ClaudeIaService.java        # Appel API Claude
│   ├── ImportExcelService.java     # Apache POI
│   ├── NotificationService.java
│   └── SchedulerService.java       # @Scheduled rappels
├── controller/
│   ├── AuthController.java
│   ├── StockController.java
│   ├── PlanController.java
│   ├── TableauBordController.java  # Dashboard analytique avant/après plan
│   ├── ReferentielController.java  # structures, produits, programmes
│   ├── StructureProgrammeController.java
│   └── NotificationController.java
└── dto/
    ├── request/
    └── response/
```

### 1.2 Dépendances Maven (pom.xml)

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>org.apache.poi</groupId>
        <artifactId>poi-ooxml</artifactId>
        <version>5.2.5</version>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### 1.3 Configuration application.properties

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/redistribution_stocks
spring.datasource.username=${DB_USER}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false

jwt.secret=${JWT_SECRET}
jwt.expiration=86400000

claude.api.key=${CLAUDE_API_KEY}
claude.api.url=https://api.anthropic.com/v1/messages
claude.api.model=claude-sonnet-4-20250514

# Seuils supply chain configurables
stock.seuil.tension=1.0
stock.seuil.surveiller=2.0
stock.seuil.surstock=4.0
stock.securite.mois=1.0
```

---

## Phase 2 — Import et saisie des stocks

### 2.1 Format Excel attendu pour l'import

Le fichier Excel doit respecter ce format (une feuille par programme) :

| Structure | Code Produit | Nom Produit | Stock Disponible | CMM | Date Péremption |
|-----------|-------------|-------------|-----------------|-----|-----------------|
| DISTRICT A | MED001 | Amoxicilline 250mg | 500 | 150 | 2026-12-31 |
| DISTRICT B | MED001 | Amoxicilline 250mg | 50 | 120 | 2026-06-30 |

### 2.2 Service ImportExcelService

```java
@Service
public class ImportExcelService {

    public List<SaisieStockDTO> parseExcel(MultipartFile file, Long periodeId, Long programmeId) {
        // 1. Ouvrir le workbook avec Apache POI
        // 2. Parcourir chaque feuille (= un programme ou une structure)
        // 3. Pour chaque ligne : retrouver structure et produit par code
        // 4. Calculer MSD = stock_disponible / CMM
        // 5. Affecter statut selon seuils configurés
        // 6. Retourner liste de DTOs pour prévisualisation avant sauvegarde
    }
}
```

### 2.3 Endpoints REST — Stocks

```
POST   /api/stocks/import                    # Upload fichier Excel
POST   /api/stocks/import/confirm            # Confirmer import après prévisualisation
POST   /api/stocks/saisie                    # Saisie manuelle
GET    /api/stocks?periodeId=&programmeId=   # Liste des saisies
GET    /api/stocks/analyse?periodeId=&programmeId=&regionId=  # Résumé tensions/surstocks
PUT    /api/stocks/{id}                      # Modifier une saisie
```

---

## Phase 3 — Complétude des saisies et relances

### 3.1 Concept de complétude

Pour une période et un programme donnés, le pharmacien de région doit savoir :
- Combien de structures sont attendues (actives sur ce programme dans sa région)
- Combien ont effectivement transmis au moins une saisie
- Lesquelles n'ont pas encore transmis

### 3.2 ComplétudeSaisieService

```java
@Service
public class ComplétudeSaisieService {

    /**
     * Retourne la complétude des saisies pour une période et un programme.
     * Périmètre limité à la région du pharmacien connecté.
     */
    public ComplétudeSaisieDTO getComplétude(Long periodeId, Long programmeId, Long regionId) {
        // 1. Récupérer les structures actives sur ce programme dans la région
        //    via structure_programme JOIN structures JOIN districts WHERE region_id = regionId
        // 2. Récupérer celles qui ont au moins une saisie pour cette période/programme
        // 3. Calculer le taux de complétude = (ayant saisi / attendues) * 100
        // 4. Retourner la liste des structures manquantes
    }
}
```

### 3.3 DTO de complétude

```java
public class ComplétudeSaisieDTO {
    private Long periodeId;
    private Long programmeId;
    private Long regionId;
    private int totalAttendu;
    private int totalSaisi;
    private double tauxComplétude; // en %
    private List<StructureSimpleDTO> structuresManquantes;
}
```

### 3.4 Endpoints REST — Complétude et relances

```
GET    /api/completude?periodeId=&programmeId=&regionId=
       # Taux de complétude + liste des structures manquantes

POST   /api/completude/relancer
       Body: { "periodeId": 1, "programmeId": 2, "structureIds": [5, 8, 12] }
       # Envoie une notification de relance aux gestionnaires des structures sélectionnées

GET    /api/structure-programme?regionId=
       # Liste des liaisons structure-programme configurées pour la région

POST   /api/structure-programme
       # Activer une structure sur un programme
       Body: { "structureId": 5, "programmeId": 2 }

DELETE /api/structure-programme/{id}
       # Désactiver la liaison (set actif = false)
```

---

## Phase 4 — Moteur d'analyse

### 4.1 AnalyseStockService

```java
@Service
public class AnalyseStockService {

    /**
     * Pour chaque produit dans une période/programme/région,
     * regroupe les structures en tension et en surstock.
     * Retourne un résumé structuré utilisable par l'IA.
     */
    public AnalyseResultatDTO analyserStocks(Long periodeId, Long programmeId, Long regionId) {
        // 1. Récupérer toutes les saisies pour la période/programme/région
        // 2. Grouper par produit
        // 3. Pour chaque produit :
        //    - Identifier structures en TENSION/RUPTURE (MSD < seuil_tension)
        //    - Identifier structures en SURSTOCK (MSD > seuil_surstock)
        //    - Calculer le stock excédentaire disponible par structure en surstock
        //    - Calculer le besoin de chaque structure en tension
        // 4. Retourner AnalyseResultatDTO
    }

    /**
     * Stock excédentaire = stock_disponible - (CMM * stock_securite_mois * 2)
     * Ne jamais proposer de transférer en dessous du stock de sécurité
     */
    private BigDecimal calculerExcedent(SaisieStock saisie) { ... }

    /**
     * Besoin = (CMM * 2) - stock_disponible (pour atteindre 2 mois de stock)
     */
    private BigDecimal calculerBesoin(SaisieStock saisie) { ... }
}
```

### 4.2 DTO de résultat d'analyse

```java
public class AnalyseResultatDTO {
    private Long periodeId;
    private Long programmeId;
    private Long regionId;
    private List<AnalyseProduitDTO> produits;
    // Chaque produit contient :
    // - structuresEnTension: [{structure, msd, besoin}]
    // - structuresEnSurstock: [{structure, msd, excedent}]
    // - potentielRedistribution: POSSIBLE | INSUFFISANT | AUCUN_SURSTOCK
}
```

---

## Phase 5 — Intégration Claude API (génération du plan IA)

### 5.1 ClaudeIaService

```java
@Service
public class ClaudeIaService {

    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final RestTemplate restTemplate;

    /**
     * Envoie l'analyse de stock à Claude et récupère un plan de réattribution structuré.
     */
    public PlanIaResponseDTO genererPlan(AnalyseResultatDTO analyse) {
        String prompt = construirePrompt(analyse);

        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 2000,
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> response = restTemplate.postForEntity(
            apiUrl, new HttpEntity<>(body, headers), Map.class
        );

        return parseReponseIa(response.getBody());
    }

    private String construirePrompt(AnalyseResultatDTO analyse) {
        return """
            Tu es un expert en gestion de la chaîne d'approvisionnement pharmaceutique en santé publique.
            
            Voici l'analyse des stocks pour la période %s, programme %s, région %s :
            
            %s
            
            Sur la base de cette analyse :
            1. Propose un plan de réattribution optimisé qui transfère les excédents des structures en surstock vers celles en tension.
            2. Respecte impérativement le stock de sécurité de chaque structure source (ne jamais descendre en dessous de 1 mois de CMM).
            3. Priorise les structures en rupture ou tension critique.
            4. Fournis une justification narrative concise (3-5 lignes).
            
            Réponds UNIQUEMENT en JSON avec ce format :
            {
              "resume": "Justification narrative du plan",
              "mouvements": [
                {
                  "produit_code": "CODE",
                  "structure_source_code": "CODE_SOURCE",
                  "structure_cible_code": "CODE_CIBLE",
                  "quantite": 150
                }
              ]
            }
            """.formatted(
                analyse.getPeriodeId(),
                analyse.getProgrammeId(),
                analyse.getRegionId(),
                objectMapper.writeValueAsString(analyse)
            );
    }
}
```

### 5.2 Endpoints REST — Plans

```
POST   /api/plans/generer              # Lancer analyse + génération IA
GET    /api/plans?periodeId=&statut=   # Liste des plans
GET    /api/plans/{id}                 # Détail d'un plan avec ses lignes
PUT    /api/plans/{id}                 # Modifier le plan (avant validation)
POST   /api/plans/{id}/valider         # Valider le plan (statut → VALIDE)
POST   /api/plans/{id}/lignes          # Ajouter une ligne manuellement
PUT    /api/plans/{id}/lignes/{lgId}   # Modifier une ligne
DELETE /api/plans/{id}/lignes/{lgId}   # Supprimer une ligne
```

---

## Phase 6 — Suivi d'exécution

### 6.1 Mise à jour du statut des lignes

```
PUT /api/plans/{id}/lignes/{lgId}/execution
Body: { "quantite_executee": 120, "statut": "EXECUTE", "notes": "..." }
```

Logique :
- Si `quantite_executee >= quantite_proposee` → statut ligne = `EXECUTE`
- Si `0 < quantite_executee < quantite_proposee` → statut ligne = `PARTIEL`
- Le plan passe à `CLOTURE` automatiquement quand toutes les lignes sont `EXECUTE` ou `ANNULE`

### 6.2 Scheduler de rappels

```java
@Service
public class SchedulerService {

    // Tous les lundis à 8h : rappel pour les plans VALIDE non clôturés depuis > 7 jours
    @Scheduled(cron = "0 0 8 * * MON")
    public void rappelPlansEnCours() {
        List<PlanReattribution> plans = planRepo.findByStatutAndDateValidationBefore(
            "EN_COURS", LocalDateTime.now().minusDays(7)
        );
        plans.forEach(plan -> notificationService.creerRappel(plan));
    }

    // Tous les jours à 7h : alerte pour les lignes en attente depuis > 14 jours
    @Scheduled(cron = "0 0 7 * * *")
    public void alerteLignesEnRetard() { ... }
}
```

---

## Phase 7 — Tableau de bord analytique (avant/après plan)

### 7.1 Objectif

Le tableau de bord permet au pharmacien de région (et à l'admin) de mesurer l'impact théorique d'un plan de réattribution pour une période et un programme donnés. Il compare l'état des stocks **avant** (saisies initiales) et **après** (MSD recalculés en supposant le plan entièrement exécuté).

### 7.2 Règle de calcul "après plan"

Le calcul est **purement théorique** — on suppose que toutes les lignes du plan sont exécutées à 100% (quantite_proposee). Aucune nouvelle saisie n'est attendue.

```
Pour chaque ligne du plan (produit P, source S, cible C, quantite Q) :

  stock_après[S][P] = stock_avant[S][P] - Q
  stock_après[C][P] = stock_avant[C][P] + Q

  MSD_après[x][P]  = stock_après[x][P] / CMM[x][P]
  statut_après[x][P] = calculé depuis MSD_après selon les seuils standards
```

La CMM reste inchangée. Si plusieurs lignes du plan touchent le même produit/structure, les ajustements sont cumulatifs.

### 7.3 Endpoint tableau de bord

```
GET /api/tableau-bord?periodeId=&programmeId=&regionId=&planId=
```

Retourne un `TableauBordDTO` contenant toutes les métriques nécessaires au frontend.

### 7.4 Métriques à calculer et afficher

#### A — Évolution des MSD par produit et par site
- **Tableau** : une ligne par produit × site, colonnes : MSD avant | MSD après | Delta | icône de tendance
  - Icône ↑ verte si MSD après > MSD avant (gain)
  - Icône ↓ rouge si MSD après < MSD avant (perte)
  - Icône = grise si inchangé
- **Graphique** : grouped bar chart horizontal — un groupe par produit, deux barres (avant/après) par site, avec couleur conditionnelle selon statut MSD

#### B — Ruptures par produit et par site
- **Tableau** : une ligne par produit, colonnes : nb sites en rupture avant | nb sites en rupture après | Delta avec icône
- **Graphique** : grouped bar chart vertical comparant avant/après par produit

#### C — Proportions de sites bien/mal stockés par produit
Formules :
```
Taux bien stockés (produit P) = (nb sites avec 2 ≤ MSD ≤ 4) / (nb sites total) × 100

Taux mal stockés (produit P)  = (nb sites avec MSD < 2 OU MSD > 4) / (nb sites total) × 100
                               = 100% - taux bien stockés

Taux bien stockés (programme) = Σ(taux_bien_stockés_p × nb_sites_p) / Σ(nb_sites_p)
                               — moyenne pondérée par nombre de sites par produit

Taux mal stockés (programme)  = 100% - taux bien stockés programme
```
- **Graphique** : stacked bar chart (100%) — une barre avant et une barre après par produit
  - Segments colorés par statut : rouge (rupture), orange (tension), jaune (surveiller), vert (normal), violet (surstock)

#### D — Taux de disponibilité par produit et par programme
Formules :
```
Taux disponibilité (produit P) = (nb sites avec MSD > 0) / (nb sites total) × 100
                                — tout site hors rupture est considéré "disponible"

Taux disponibilité (programme) = Σ(taux_dispo_p × nb_sites_p) / Σ(nb_sites_p)
                                — moyenne pondérée par nombre de sites par produit
                                — équivaut à : nb combinaisons (site×produit) avec MSD>0
                                               / nb total combinaisons (site×produit)
```
- **Affichage** : tableau avec barres de progression doubles (avant/après) + delta avec icône

#### E — Métriques analytiques additionnelles (enrichissement expert)
- **Score d'impact global du plan** : somme des gains MSD sur l'ensemble des sites, normalisée
- **Top 5 mouvements les plus impactants** : classés par gain MSD sur la structure cible
- **Taux de couverture programme** : % de produits en statut NORMAL après exécution du plan
- **Indice de risque régional avant/après** : (nb ruptures × 3) + (nb tensions × 2) + (nb surstock × 1) — score composite à minimiser
- **Complétude d'exécution du plan** : % de lignes du plan réellement exécutées (EXECUTE ou PARTIEL)

### 7.5 TableauBordController (Spring Boot)

```java
@RestController
@RequestMapping("/api/tableau-bord")
public class TableauBordController {

    @GetMapping
    @PreAuthorize("hasAnyRole('PHARMACIEN_REGION', 'ADMIN')")
    public ResponseEntity<TableauBordDTO> getTableauBord(
        @RequestParam Long periodeId,
        @RequestParam Long programmeId,
        @RequestParam(required = false) Long regionId, // null = toutes régions (ADMIN)
        @RequestParam Long planId
    ) { ... }
}
```

---

## Phase 8 — Frontend Angular (PrimeNG Poseidon)

### 8.1 Structure des modules Angular

```
src/app/
├── core/
│   ├── auth/                    # JWT interceptor, AuthGuard, RoleGuard
│   ├── services/
│   │   ├── stock.service.ts
│   │   ├── plan.service.ts
│   │   ├── completude.service.ts
│   │   ├── tableau-bord.service.ts
│   │   └── notification.service.ts
│   └── models/                  # Interfaces TypeScript
├── shared/
│   └── components/
│       ├── msd-badge/           # Badge coloré selon statut MSD
│       ├── delta-icon/          # Icône ↑↓= avec couleur selon delta
│       └── progress-bar-avant-apres/
├── features/
│   ├── auth/                    # Login
│   ├── referentiel/             # Gestion structures, produits, programmes (ADMIN)
│   ├── structure-programme/     # Configuration liaisons structure-programme (PHARMACIEN_REGION)
│   ├── stocks/
│   │   ├── saisie/              # Formulaire saisie manuelle (GESTIONNAIRE)
│   │   ├── import/              # Upload Excel + prévisualisation
│   │   ├── historique/          # Historique des saisies (GESTIONNAIRE: sa structure)
│   │   └── consultation/        # Consultation tous sites (PHARMACIEN_REGION + ADMIN)
│   ├── completude/
│   │   ├── suivi-completude/    # Taux de complétude par période/programme (PHARMACIEN_REGION)
│   │   └── relance/             # Liste sites manquants + action relance
│   ├── plans/
│   │   ├── generation/          # Déclenchement analyse + affichage plan IA (PHARMACIEN_REGION)
│   │   ├── edition/             # Modification manuelle du plan
│   │   ├── suivi/               # Suivi d'exécution des lignes
│   │   └── consultation-plans/  # Lecture seule pour GESTIONNAIRE
│   ├── tableau-bord/
│   │   └── dashboard/           # Dashboard analytique avant/après (PHARMACIEN_REGION + ADMIN)
│   └── notifications/           # Centre de notifications
└── app-routing.module.ts
```

### 8.2 Vues clés à développer

#### Vue GESTIONNAIRE — Saisie de stock (`/stocks/saisie`)
- Formulaire de saisie par produit pour sa structure
- Import Excel de sa structure
- Historique des saisies passées (filtres par période)
- Consultation lecture seule des plans générés et de leur avancement

#### Vue PHARMACIEN_REGION — Complétude des saisies (`/completude`)
- Filtres : Période (sélection par date_ras) / Programme
- Indicateur circulaire : X/Y structures ont saisi (taux en %)
- Tableau des structures manquantes avec bouton "Relancer" individuel ou groupé
- Lien vers configuration des structures actives par programme

#### Vue PHARMACIEN_REGION — Configuration structures-programmes (`/structure-programme`)
- Liste des structures de la région avec leurs programmes actifs
- Toggle par programme pour activer/désactiver une structure
- Sauvegarde immédiate via PATCH

#### Vue PHARMACIEN_REGION — Génération de plan (`/plans/generation`)
- Sélection période / programme / région
- Bouton "Analyser et générer un plan"
- Affichage du résumé narratif de l'IA (card avec icône IA)
- Tableau des mouvements proposés (modifiable inline)
- Bouton "Valider le plan"

#### Vue PHARMACIEN_REGION + ADMIN — Tableau de bord analytique (`/tableau-bord`)
- Filtres : Période / Programme / Région (toutes pour ADMIN) / Plan
- **Section A** : Tableau MSD avant/après avec icônes delta + grouped bar chart horizontal
- **Section B** : Tableau ruptures avant/après par produit + bar chart vertical
- **Section C** : Stacked bar chart proportions de statuts avant/après par produit
- **Section D** : Tableau taux de disponibilité avec barres de progression doubles
- **Section E** : Cards métriques analytiques (score impact, top 5, taux couverture, indice risque)
- Bouton export PDF du tableau de bord

#### Vue Suivi d'exécution (`/plans/suivi`)
- Liste des plans validés
- Pour chaque ligne : statut, quantité proposée vs exécutée, bouton de mise à jour
- Indicateur de progression du plan (% lignes exécutées)

---

## Règles de développement

### Sécurité et contrôle d'accès
- Toutes les routes API (sauf `/api/auth/**`) doivent être protégées par JWT
- **GESTIONNAIRE** : lecture/écriture uniquement sur sa propre structure ; lecture seule des plans
- **PHARMACIEN_REGION** : lecture toutes structures de sa région ; génération de plans pour sa région ; configuration structure-programme dans sa région
- **ADMIN** : accès lecture à toutes les régions ; CRUD référentiel ; pas de génération de plan
- Toute requête vérifie le périmètre (region_id ou structure_id) de l'utilisateur connecté

### Gestion du cycle de vie des périodes
- Une période est créée par le pharmacien de région pour **sa région uniquement**
- Les structures ne voient et ne peuvent saisir que sur une période **OUVERTE** de leur région
- Une période passe automatiquement à **FERMEE** quand tous les plans pour tous les programmes actifs de la région sont générés (statut != BROUILLON)
- Le pharmacien de région peut **rouvrir** manuellement une période FERMEE → OUVERTE
- `annee` et `mois` sont calculés côté backend depuis `date_ras` à la création

Endpoints périodes :
```
POST   /api/periodes                    # Créer une période (PHARMACIEN_REGION)
GET    /api/periodes?regionId=          # Lister les périodes d'une région
PUT    /api/periodes/{id}/reopen        # Rouvrir une période FERMEE → OUVERTE
PUT    /api/periodes/{id}/close         # Fermer manuellement une période OUVERTE → FERMEE
```

### Validation des données
- Le stock disponible ne peut pas être négatif
- La CMM doit être > 0 pour qu'un MSD soit calculable
- Un plan ne peut être validé que s'il a au moins une ligne
- Un plan validé ne peut plus être supprimé, seulement clôturé
- Une structure ne peut saisir un état que sur une période **OUVERTE** de sa région
- Unicité : une seule période par `(region_id, date_ras)`

### Gestion d'erreurs
- Toutes les erreurs API retournent un objet `{ code, message, details }`
- Les erreurs d'appel Claude API ne doivent pas bloquer le workflow — proposer la génération manuelle en fallback

---

## Variables d'environnement requises

```bash
DB_USER=postgres
DB_PASSWORD=secret
JWT_SECRET=your_jwt_secret_key_minimum_256_bits
CLAUDE_API_KEY=sk-ant-...
```

---

## Ordre d'implémentation recommandé

1. Créer le schéma PostgreSQL avec les migrations Flyway
2. Générer les entités JPA et repositories
3. Implémenter AuthController + JWT
4. Implémenter ReferentielController (CRUD structures, produits, programmes)
5. Implémenter StructureProgrammeController (configuration liaisons)
6. Implémenter StockController (saisie + import Excel)
7. Implémenter ComplétudeSaisieService + endpoints complétude/relance
8. Implémenter AnalyseStockService (logique MSD / seuils)
9. Implémenter ClaudeIaService + PlanController
10. Implémenter TableauBordController (métriques avant/après)
11. Implémenter SchedulerService + NotificationService
12. Développer le frontend Angular module par module :
    Auth → Référentiel → Structure-Programme → Stocks (saisie/import) → Complétude → Plans → Tableau de bord
