import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParametreRegion {
  regionId: number;
  regionNom: string;
  seuilStockSecuriteMsd: number;
}

@Injectable({ providedIn: 'root' })
export class ParametreService {
  constructor(private http: HttpClient) {}

  getParametres(regionId?: number): Observable<ParametreRegion> {
    let params = new HttpParams();
    if (regionId != null) params = params.set('regionId', regionId.toString());
    return this.http.get<ParametreRegion>('/api/parametres/region', { params });
  }

  updateParametres(seuil: number, regionId?: number): Observable<ParametreRegion> {
    const body: { seuilStockSecuriteMsd: number; regionId?: number } = { seuilStockSecuriteMsd: seuil };
    if (regionId != null) body.regionId = regionId;
    return this.http.put<ParametreRegion>('/api/parametres/region', body);
  }
}
