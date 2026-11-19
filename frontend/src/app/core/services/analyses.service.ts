import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Interpretation { lecture: string[]; aFaire: string[]; }
export interface Element { id: number; code: string; nom: string; }
export interface Cellule { siteId: number; produitId: number; statutAvant: string; statutApres: string; msdAvant: number | null; msdApres: number | null; }
export interface Boite { min: number; q1: number; mediane: number; q3: number; max: number; ecartInterquartile: number; }
export interface DispersionProduit { produitId: number; produit: string; nbSites: number; avant: Boite; apres: Boite; variationPct: number | null; verdict: string; }
export interface LotPerimable { site: string; produit: string; unite: string; quantite: number; datePeremption: string; }
export interface RuptureAVenir { site: string; produit: string; dateEstimee: string; joursRestants: number; }
export interface Chronique { site: string; produit: string; nbFois: number; }
export interface SurstockProduit { produit: string; nbSites: number; nbSitesSuivis: number; }
export interface FiabiliteSite { site: string; nbMouvements: number; tauxLivraison: number; nbEnRetard: number; delaiMoyenJours: number | null; verdict: string; }
export interface Flux { districtSource: string; districtCible: string; nbMouvements: number; nbProduits: number; }

export interface Baremes {
  equilibrageNetPct: number; equilibrageModerePct: number; alerteHorizonJours: number;
  chroniqueFenetre: number; chroniqueOccurrences: number; fiabiliteBonnePct: number;
  fiabiliteFaiblePct: number; retardJours: number; fragilitePct: number;
}

export interface Analyses {
  baseApres: 'PREVUE' | 'EXECUTEE';
  baremes: Baremes;
  matrice: { sites: Element[]; produits: Element[]; cellules: Cellule[]; interpretation: Interpretation };
  dispersion: { produits: DispersionProduit[]; interpretation: Interpretation };
  peremptions: { evitees: LotPerimable[]; aRisque: LotPerimable[]; interpretation: Interpretation };
  alerte: { horizonJours: number; nbAvant: number; nbApres: number; ageEtatJours: number; restantes: RuptureAVenir[]; interpretation: Interpretation };
  chroniques: { fenetre: number; occurrences: number; periodesAnalysees: number; ruptures: Chronique[]; surstocks: SurstockProduit[]; interpretation: Interpretation };
  fiabilite: { nbPlans: number; sites: FiabiliteSite[]; interpretation: Interpretation };
  flux: Flux[];
}

export interface Tendance { periode: string; tauxDisponibilite: number; tauxBienStocke: number; indiceRisque: number; }

/** Analyses d'un plan, tendances des indicateurs et barèmes de lecture. */
@Injectable({ providedIn: 'root' })
export class AnalysesService {
  private http = inject(HttpClient);

  private params(periodeId: number, programmeId: number, planId: number, base?: string | null): HttpParams {
    let p = new HttpParams().set('periodeId', periodeId).set('programmeId', programmeId).set('planId', planId);
    if (base) p = p.set('base', base);
    return p;
  }

  analyses(periodeId: number, programmeId: number, planId: number, base?: string | null): Observable<Analyses> {
    return this.http.get<Analyses>('/api/tableau-bord/analyses', { params: this.params(periodeId, programmeId, planId, base) });
  }

  tendances(periodeId: number, programmeId: number, planId: number): Observable<Tendance[]> {
    return this.http.get<Tendance[]>('/api/tableau-bord/tendances', { params: this.params(periodeId, programmeId, planId) });
  }

  baremes(): Observable<Baremes> {
    return this.http.get<Baremes>('/api/parametres/analyse');
  }

  modifierBaremes(b: Baremes): Observable<Baremes> {
    return this.http.put<Baremes>('/api/parametres/analyse', b);
  }
}
