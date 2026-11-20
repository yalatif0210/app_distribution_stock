import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { sansVoile } from '../http/chargement';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExecutionProgressionItem, LignePlan, PlanReattribution, Reception, ReceptionRequest, StockSourceInfo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private http: HttpClient) {}

  generer(periodeId: number, programmeId: number | null, regionId: number, notes?: string,
          remplacerBrouillon = false, analyseIa = true): Observable<PlanReattribution> {
    return this.http.post<PlanReattribution>('/api/plans/generer',
      { periodeId, programmeId, regionId, notes, remplacerBrouillon, analyseIa });
  }

  /** L'analyse IA est-elle configurée sur le serveur ? */
  iaDisponible(): Observable<{ disponible: boolean }> {
    return this.http.get<{ disponible: boolean }>('/api/plans/ia-disponible');
  }

  /** Brouillon déjà en cours pour ce périmètre, ou null (réponse 204). */
  getBrouillon(periodeId: number, programmeId: number | null, regionId: number): Observable<PlanReattribution | null> {
    let params = new HttpParams().set('periodeId', periodeId).set('regionId', regionId);
    if (programmeId != null) params = params.set('programmeId', programmeId);
    return this.http.get<PlanReattribution | null>('/api/plans/brouillon', { params });
  }

  getPlans(periodeId?: number, statut?: string): Observable<PlanReattribution[]> {
    let params = new HttpParams();
    if (periodeId) params = params.set('periodeId', periodeId.toString());
    if (statut) params = params.set('statut', statut);
    return this.http.get<PlanReattribution[]>('/api/plans', { params });
  }

  getPlan(id: number): Observable<PlanReattribution> {
    return this.http.get<PlanReattribution>(`/api/plans/${id}`);
  }

  valider(id: number): Observable<PlanReattribution> {
    return this.http.post<PlanReattribution>(`/api/plans/${id}/valider`, {});
  }

  /** `fond` : enregistrement automatique (répartition manuelle), sans voile de chargement. */
  ajouterLigne(planId: number, data: Partial<LignePlan>, fond = false): Observable<LignePlan> {
    return this.http.post<LignePlan>(`/api/plans/${planId}/lignes`, data, fond ? { context: sansVoile() } : {});
  }

  modifierLigne(planId: number, ligneId: number, data: Partial<LignePlan>, fond = false): Observable<LignePlan> {
    return this.http.put<LignePlan>(`/api/plans/${planId}/lignes/${ligneId}`, data, fond ? { context: sansVoile() } : {});
  }

  supprimerPlan(id: number): Observable<void> {
    return this.http.delete<void>(`/api/plans/${id}`);
  }

  supprimerLigne(planId: number, ligneId: number, fond = false): Observable<void> {
    return this.http.delete<void>(`/api/plans/${planId}/lignes/${ligneId}`, fond ? { context: sansVoile() } : {});
  }

  executerLigne(planId: number, ligneId: number, quantiteExecutee: number, notes?: string): Observable<LignePlan> {
    return this.http.put<LignePlan>(`/api/plans/${planId}/lignes/${ligneId}/execution`, { quantiteExecutee, notes });
  }

  /** Réception confirmée par le site destinataire : le cumul devient la quantité exécutée. */
  receptionner(planId: number, ligneId: number, req: ReceptionRequest): Observable<LignePlan> {
    return this.http.post<LignePlan>(`/api/plans/${planId}/lignes/${ligneId}/receptions`, req);
  }

  receptions(planId: number, ligneId: number): Observable<Reception[]> {
    return this.http.get<Reception[]>(`/api/plans/${planId}/lignes/${ligneId}/receptions`);
  }

  getStockSource(periodeId: number, produitId: number, structureSourceId: number,
                 planId: number, excludeLigneId?: number): Observable<StockSourceInfo> {
    let params = new HttpParams()
      .set('periodeId', periodeId)
      .set('produitId', produitId)
      .set('structureSourceId', structureSourceId)
      .set('planId', planId);
    if (excludeLigneId != null) params = params.set('excludeLigneId', excludeLigneId);
    return this.http.get<StockSourceInfo>('/api/plans/stock-source', { params });
  }

  getExecutionProgression(annee: number, regionId?: number | null, programmeId?: number | null): Observable<ExecutionProgressionItem[]> {
    let params = new HttpParams().set('annee', annee.toString());
    if (regionId) params = params.set('regionId', regionId.toString());
    if (programmeId) params = params.set('programmeId', programmeId.toString());
    return this.http.get<{ items: ExecutionProgressionItem[] }>('/api/plans/execution/progression', { params })
      .pipe(map(r => r.items));
  }
}
