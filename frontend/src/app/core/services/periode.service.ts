import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PeriodeSaisie } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PeriodeService {
  constructor(private http: HttpClient) {}

  createPeriode(dateRas: string): Observable<PeriodeSaisie> {
    return this.http.post<PeriodeSaisie>('/api/periodes', { dateRas });
  }

  findByRegion(): Observable<PeriodeSaisie[]> {
    return this.http.get<PeriodeSaisie[]>('/api/periodes');
  }

  getAllPeriodes(): Observable<PeriodeSaisie[]> {
    return this.http.get<PeriodeSaisie[]>('/api/periodes/all');
  }

  rouvrirPeriode(id: number): Observable<void> {
    return this.http.put<void>(`/api/periodes/${id}/rouvrir`, {});
  }

  fermerPeriode(id: number): Observable<void> {
    return this.http.put<void>(`/api/periodes/${id}/fermer`, {});
  }

  deletePeriode(id: number): Observable<void> {
    return this.http.delete<void>(`/api/periodes/${id}`);
  }
}
