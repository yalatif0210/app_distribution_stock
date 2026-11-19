import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StatGroupe {
  libelle: string; nbPlans: number; nbMouvements: number; nbExecutesAuMoinsEnPartie: number;
  tauxExecutionMouvements: number; tauxExecutionQuantites: number; nbRupturesResorbees: number;
}
export interface StatProduit {
  programme: string; code: string; nom: string; unite: string; nbMouvements: number;
  quantitePrevue: number; quantiteExecutee: number; tauxExecutionQuantites: number;
}
export interface StatSite {
  nom: string; region: string; nbMouvements: number; nbExecutesAuMoinsEnPartie: number;
  nbProduits: number; nbRupturesResorbees: number;
}
export interface Statistiques {
  debut: string; fin: string; niveau: string; programme: string;
  synthese: {
    nbPlans: number; nbPlansClotures: number; nbRegions: number;
    nbMouvements: number; nbExecutes: number; nbPartiels: number; nbEnAttente: number;
    tauxExecutionMouvements: number; tauxExecutionQuantites: number;
    delaiMoyenJours: number | null; delaiMedianJours: number | null;
    nbRupturesResorbees: number; nbCiblesServies: number;
  };
  parRegion: StatGroupe[]; parProgramme: StatGroupe[]; parMois: StatGroupe[];
  parProduit: StatProduit[]; sitesSources: StatSite[]; sitesCibles: StatSite[];
}

export interface FiltreStatistiques {
  debut: string; fin: string; regionId?: number | null; programmeId?: number | null;
}

/** Statistiques des plans de redéploiement validés sur une plage de dates. */
@Injectable({ providedIn: 'root' })
export class StatistiquesService {
  private http = inject(HttpClient);

  private params(f: FiltreStatistiques): HttpParams {
    let p = new HttpParams().set('debut', f.debut).set('fin', f.fin);
    if (f.regionId != null) p = p.set('regionId', f.regionId);
    if (f.programmeId != null) p = p.set('programmeId', f.programmeId);
    return p;
  }

  calculer(f: FiltreStatistiques): Observable<Statistiques> {
    return this.http.get<Statistiques>('/api/statistiques', { params: this.params(f) });
  }

  exporter(f: FiltreStatistiques, format: 'excel' | 'pdf'): Observable<Blob> {
    return this.http.get(`/api/statistiques/export/${format}`, { params: this.params(f), responseType: 'blob' });
  }
}
