export interface Region { id: number; nom: string; }
export interface District { id: number; nom: string; regionId: number; regionNom: string; }
export interface Structure {
  id: number; code: string; nom: string; type: string;
  districtId: number; districtNom: string; regionId: number; regionNom: string; active: boolean;
}
export interface Programme { id: number; code: string; nom: string; description: string; active: boolean; }
export interface Produit { id: number; code: string; nom: string; unite: string; programmeId: number; programmeCode: string; actif: boolean; }
export interface PeriodeSaisie {
  id: number;
  annee: number;
  mois: number;
  dateRas: string;
  statut: 'OUVERTE' | 'FERMEE' | string;
  libelle?: string;
  regionId?: number;
  regionNom?: string;
}

export interface SaisieStock {
  id: number; periodeId: number; periodeLibelle: string;
  structureId: number; structureNom: string; structureCode: string; structureRegionId: number;
  produitId: number; produitNom: string; produitCode: string; produitUnite: string;
  stockDisponible: number; cmm: number; stockSecurite: number; msd: number;
  expireDate: string; statutStock: string; dateSaisie: string; source: string;
}

export interface AnalyseResultat {
  periodeId: number; programmeId: number; regionId: number;
  periodeLibelle: string; programmeNom: string; regionNom: string;
  produits: AnalyseProduit[];
  nbProduitsEnTension: number; nbProduitsEnSurstock: number; nbProduitsEnRupture: number;
}
export interface AnalyseProduit {
  produitId: number; produitCode: string; produitNom: string; produitUnite: string;
  structuresEnRupture: StructureAnalyse[]; structuresEnTension: StructureAnalyse[];
  structuresEnSurstock: StructureAnalyse[]; potentielRedistribution: string;
  diagnostiqueSource?: string;
}
export interface StructureAnalyse {
  structureId: number; structureCode: string; structureNom: string;
  msd: number; stockDisponible: number; cmm: number; besoin: number; excedent: number; statutStock: string;
}

export interface LignePlan {
  id: number; produitId: number; produitCode: string; produitNom: string; produitUnite: string;
  structureSourceId: number; structureSourceNom: string;
  structureCibleId: number; structureCibleNom: string;
  quantiteProposee: number; quantiteExecutee: number; statut: string;
  expireDate: string | null;
  dateExecution: string | null; notes: string | null; progression: number;
}

export interface StockSourceInfo {
  stockBrut: number;
  allocationsExistantes: number;
  stockNet: number;
  expireDateFefo: string | null;
}
export interface PlanReattribution {
  id: number; periodeId: number; periodeLibelle: string;
  programmeId: number; programmeNom: string; regionId: number; regionNom: string;
  statut: string; genereParlA: boolean; resumeIa: string | null;
  dateGeneration: string; dateValidation: string | null; valideParUsername: string | null;
  dateCloture: string | null; notes: string | null; lignes: LignePlan[];
  nbLignes: number; nbLignesExecutees: number; progression: number;
}

export interface AppNotification {
  id: number; planId: number | null; lignePlanId: number | null; type: string;
  message: string; lu: boolean; dateEnvoi: string;
}

export interface AuthResponse { token: string; username: string; role: string; utilisateurId: number; structureId: number | null; regionId: number | null; supervisedRegionIds: number[]; structureNom?: string; regionNom?: string; }

export interface LigneSaisie {
  saisieId: number | null;
  produitId: number;
  produitCode: string;
  produitNom: string;
  produitUnite: string;
  stockDisponible: number | null;
  cmm: number | null;
  stockSecurite: number | null;
  msd: number | null;
  expireDate: string | null;
  statutStock: string | null;
  saved: boolean;
  risquePeremption?: boolean;
  surplusMois?: number;
}

export interface ProduitSelection {
  produitId: number;
  produitCode: string;
  produitNom: string;
  produitUnite: string;
  actif: boolean;
}

export interface EtatStockSummary {
  id: number;
  periodeId: number; periodeLibelle: string;
  structureId: number; structureNom: string; structureCode: string; structureType: string;
  programmeId: number; programmeNom: string;
  statut: 'SUGGESTED' | 'SUBMITTED';
  dateCreation: string | null; dateSoumission: string | null;
  nbLignes: number; nbLignesSaved: number; nbLignesIgnored: number;
}

export interface EtatStock {
  id: number | null;
  periodeId: number;
  periodeLibelle: string;
  periodeRas: string;
  structureId: number;
  structureNom: string;
  structureCode: string;
  programmeId: number;
  programmeNom: string;
  statut: 'SUGGESTED' | 'SUBMITTED';
  dateCreation: string | null;
  dateSoumission: string | null;
  lignes: LigneSaisie[];
}

export interface UtilisateurDTO {
  id: number;
  username: string;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
  roleId: number;
  roleNom: string;
  structureId: number | null;
  structureNom: string | null;
  regionId: number | null;
  regionNom: string | null;
  supervisedRegionIds: number[];
  supervisedDistrictIds: number[];
  supervisedStructureIds: number[];
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: number;
  messages: string[];
}

export interface LigneErreur {
  numLigne: number;
  produitCode: string;
  regle: string;
  valeurs: string;
}

export interface ImportResultat {
  success: boolean;
  nbImportes: number;
  erreurs: LigneErreur[];
  importes: SaisieStock[];
}

export interface ExecutionProgressionItem {
  periodeId: number;
  periodeLabel: string;
  progressionMoyenne: number;
  nbPlans: number;
}

export const STATUTS_STOCK = ['RUPTURE', 'TENSION', 'SURVEILLER', 'BIEN_STOCKE', 'SURSTOCK', 'STOCK_DORMANT'] as const;
export type StatutStock = typeof STATUTS_STOCK[number];

export interface StructureProgramme {
  id: number;
  structureId: number; structureCode: string; structureNom: string; structureType: string;
  programmeId: number; programmeCode: string; programmeNom: string;
  actif: boolean;
}

export interface CompletudeDTO {
  periodeId: number; programmeId: number; regionId: number;
  programmeNom: string; periodeLibelle: string;
  totalAttendu: number; totalSaisi: number; tauxCompletude: number;
  structuresManquantes: { id: number; code: string; nom: string; type: string }[];
}

export interface TableauBordDTO {
  periodeId: number; programmeId: number; regionId: number; planId: number;
  periodeLibelle: string; programmeNom: string; regionNom: string; planStatut: string;
  evolutionMsd: MsdEvolution[];
  evolutionRuptures: RuptureEvolution[];
  proportionsStockage: ProportionStockage[];
  disponibilites: DisponibiliteItem[];
  tauxDispoGlobalAvant: number; tauxDispoGlobalApres: number;
  tauxBienStockeGlobalAvant: number; tauxBienStockeGlobalApres: number;
  analytique: AnalytiqueData;
}

export interface MsdEvolution {
  produitId: number; produitNom: string; produitCode: string;
  structureId: number; structureNom: string;
  msdAvant: number; msdApres: number; deltaMsd: number;
  statutAvant: string; statutApres: string;
  tendance: 'GAIN' | 'PERTE' | 'STABLE';
}

export interface RuptureEvolution {
  produitId: number; produitNom: string;
  nbRupturesAvant: number; nbRupturesApres: number; delta: number;
  tendance: 'AMELIORATION' | 'DEGRADATION' | 'STABLE';
}

export interface ProportionStockage {
  produitId: number; produitNom: string;
  nbRuptureAvant: number; nbTensionAvant: number; nbSurveillerAvant: number; nbNormalAvant: number; nbSurstockAvant: number;
  nbRuptureApres: number; nbTensionApres: number; nbSurveillerApres: number; nbNormalApres: number; nbSurstockApres: number;
  tauxBienStockeAvant: number; tauxMalStockeAvant: number;
  tauxBienStockeApres: number; tauxMalStockeApres: number;
  deltaBienStocke: number; nbSitesTotal: number;
}

export interface DisponibiliteItem {
  produitId: number; produitNom: string;
  tauxDispoAvant: number; tauxDispoApres: number; deltaDispo: number;
  tendance: 'AMELIORATION' | 'DEGRADATION' | 'STABLE';
}

export interface AnalytiqueData {
  scoreImpactGlobal: number;
  top5Mouvements: { lignePlanId: number; produitNom: string; structureSourceNom: string; structureCibleNom: string; quantiteProposee: number; gainMsdCible: number }[];
  tauxCouvertureProgrammeAvant: number; tauxCouvertureProgrammeApres: number;
  indiceRisqueAvant: number; indiceRisqueApres: number;
  completudeExecution: number;
  nbSitesAmeliores: number; nbSitesDegrades: number;
}
