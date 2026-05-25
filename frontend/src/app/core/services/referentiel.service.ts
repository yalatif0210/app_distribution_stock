import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { District, ImportResult, PeriodeSaisie, Produit, Programme, Region, Structure } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ReferentielService {
  constructor(private http: HttpClient) {}

  getRegions(): Observable<Region[]> { return this.http.get<Region[]>('/api/referentiel/regions'); }

  getDistricts(regionId?: number): Observable<District[]> {
    const params: Record<string, string> = {};
    if (regionId) params['regionId'] = regionId.toString();
    return this.http.get<District[]>('/api/referentiel/districts', { params });
  }

  getStructures(regionId?: number, districtId?: number): Observable<Structure[]> {
    const params: Record<string, string> = {};
    if (regionId) params['regionId'] = regionId.toString();
    if (districtId) params['districtId'] = districtId.toString();
    return this.http.get<Structure[]>('/api/referentiel/structures', { params });
  }

  getProgrammes(): Observable<Programme[]> { return this.http.get<Programme[]>('/api/referentiel/programmes'); }

  getProduits(programmeId?: number): Observable<Produit[]> {
    const params: Record<string, string> = {};
    if (programmeId) params['programmeId'] = programmeId.toString();
    return this.http.get<Produit[]>('/api/referentiel/produits', { params });
  }

  getPeriodes(): Observable<PeriodeSaisie[]> { return this.http.get<PeriodeSaisie[]>('/api/referentiel/periodes'); }

  createPeriode(annee: number, mois: number, dateRas: string): Observable<PeriodeSaisie> {
    return this.http.post<PeriodeSaisie>('/api/referentiel/periodes', { annee, mois, dateRas });
  }

  fermerPeriode(id: number): Observable<void> {
    return this.http.put<void>(`/api/referentiel/periodes/${id}/fermer`, {});
  }

  importGeo(file: File): Observable<ImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportResult>('/api/referentiel/import/geo', fd);
  }

  importCatalogue(file: File): Observable<ImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportResult>('/api/referentiel/import/catalogue', fd);
  }
}
