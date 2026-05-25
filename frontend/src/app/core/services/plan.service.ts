import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExecutionProgressionItem, LignePlan, PlanReattribution, StockSourceInfo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private http: HttpClient) {}

  generer(periodeId: number, programmeId: number | null, regionId: number, notes?: string): Observable<PlanReattribution> {
    return this.http.post<PlanReattribution>('/api/plans/generer', { periodeId, programmeId, regionId, notes });
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

  ajouterLigne(planId: number, data: Partial<LignePlan>): Observable<LignePlan> {
    return this.http.post<LignePlan>(`/api/plans/${planId}/lignes`, data);
  }

  modifierLigne(planId: number, ligneId: number, data: Partial<LignePlan>): Observable<LignePlan> {
    return this.http.put<LignePlan>(`/api/plans/${planId}/lignes/${ligneId}`, data);
  }

  supprimerPlan(id: number): Observable<void> {
    return this.http.delete<void>(`/api/plans/${id}`);
  }

  supprimerLigne(planId: number, ligneId: number): Observable<void> {
    return this.http.delete<void>(`/api/plans/${planId}/lignes/${ligneId}`);
  }

  executerLigne(planId: number, ligneId: number, quantiteExecutee: number, notes?: string): Observable<LignePlan> {
    return this.http.put<LignePlan>(`/api/plans/${planId}/lignes/${ligneId}/execution`, { quantiteExecutee, notes });
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
