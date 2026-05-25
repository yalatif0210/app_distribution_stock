import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalyseResultat, EtatStock, EtatStockSummary, ImportResultat, LigneSaisie, ProduitSelection, Programme, SaisieStock } from '../models/models';

@Injectable({ providedIn: 'root' })
export class StockService {
  constructor(private http: HttpClient) {}

  // ─── Workflow SUGGESTED / SUBMITTED ────────────────────────────────────────

  getEtat(periodeId: number, programmeId: number, structureId: number): Observable<EtatStock> {
    const params = new HttpParams()
      .set('periodeId', periodeId)
      .set('programmeId', programmeId)
      .set('structureId', structureId);
    return this.http.get<EtatStock>('/api/stocks/etat', { params });
  }

  initEtat(periodeId: number, programmeId: number, structureId: number): Observable<EtatStock> {
    const params = new HttpParams()
      .set('periodeId', periodeId)
      .set('programmeId', programmeId)
      .set('structureId', structureId);
    return this.http.post<EtatStock>('/api/stocks/etat/init', null, { params });
  }

  saveLigne(req: {
    etatId: number;
    produitId: number;
    stockDisponible: number | null;
    cmm: number | null;
    expireDate: string | null;
  }): Observable<LigneSaisie> {
    return this.http.post<LigneSaisie>('/api/stocks/etat/ligne', req);
  }

  submitEtat(etatId: number): Observable<EtatStock> {
    return this.http.post<EtatStock>(`/api/stocks/etat/${etatId}/submit`, null);
  }

  reopenEtat(etatId: number): Observable<EtatStock> {
    return this.http.post<EtatStock>(`/api/stocks/etat/${etatId}/reopen`, null);
  }

  // ─── Tableau de bord / lecture ──────────────────────────────────────────────

  getSaisies(periodeId: number, programmeId?: number): Observable<SaisieStock[]> {
    let params = new HttpParams().set('periodeId', periodeId.toString());
    if (programmeId) params = params.set('programmeId', programmeId.toString());
    return this.http.get<SaisieStock[]>('/api/stocks', { params });
  }

  importExcel(file: File, periodeId: number, programmeId: number): Observable<ImportResultat> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams()
      .set('periodeId', periodeId.toString())
      .set('programmeId', programmeId.toString());
    return this.http.post<ImportResultat>('/api/stocks/import', form, { params });
  }

  downloadTemplate(programmeId: number): Observable<Blob> {
    const params = new HttpParams().set('programmeId', programmeId.toString());
    return this.http.get('/api/stocks/import/template', { params, responseType: 'blob' });
  }

  analyser(periodeId: number, programmeId: number, regionId?: number): Observable<AnalyseResultat> {
    let params = new HttpParams()
      .set('periodeId', periodeId.toString())
      .set('programmeId', programmeId.toString());
    if (regionId != null) params = params.set('regionId', regionId.toString());
    return this.http.get<AnalyseResultat>('/api/stocks/analyse', { params });
  }

  listEtats(periodeId: number, programmeId?: number | null, regionId?: number | null): Observable<EtatStockSummary[]> {
    let params = new HttpParams().set('periodeId', periodeId);
    if (programmeId) params = params.set('programmeId', programmeId);
    if (regionId) params = params.set('regionId', regionId);
    return this.http.get<EtatStockSummary[]>('/api/stocks/etats', { params });
  }

  deleteEtat(etatId: number): Observable<void> {
    return this.http.delete<void>(`/api/stocks/etat/${etatId}`);
  }

  // ─── Sélection des produits gérés (GESTIONNAIRE) ───────────────────────────

  getProgrammesActifs(structureId: number): Observable<Programme[]> {
    const params = new HttpParams().set('structureId', structureId);
    return this.http.get<Programme[]>('/api/selection-produits/programmes', { params });
  }

  getSelectionProduits(structureId: number, programmeId: number): Observable<ProduitSelection[]> {
    const params = new HttpParams()
      .set('structureId', structureId)
      .set('programmeId', programmeId);
    return this.http.get<ProduitSelection[]>('/api/selection-produits', { params });
  }

  toggleSelectionProduit(structureId: number, programmeId: number, produitId: number, actif: boolean): Observable<ProduitSelection> {
    return this.http.put<ProduitSelection>('/api/selection-produits', { structureId, programmeId, produitId, actif });
  }
}
