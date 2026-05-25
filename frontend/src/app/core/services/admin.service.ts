import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Region, District, Structure, Programme, Produit, UtilisateurDTO, PeriodeSaisie } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  // Régions
  createRegion(nom: string): Observable<Region> { return this.http.post<Region>('/api/referentiel/regions', { nom }); }
  updateRegion(id: number, nom: string): Observable<Region> { return this.http.put<Region>(`/api/referentiel/regions/${id}`, { nom }); }
  deleteRegion(id: number): Observable<void> { return this.http.delete<void>(`/api/referentiel/regions/${id}`); }

  // Districts
  createDistrict(nom: string, regionId: number): Observable<District> { return this.http.post<District>('/api/referentiel/districts', { nom, regionId }); }
  updateDistrict(id: number, nom: string, regionId: number): Observable<District> { return this.http.put<District>(`/api/referentiel/districts/${id}`, { nom, regionId }); }
  deleteDistrict(id: number): Observable<void> { return this.http.delete<void>(`/api/referentiel/districts/${id}`); }

  // Structures
  createStructure(data: Partial<Structure> & { districtId: number }): Observable<Structure> { return this.http.post<Structure>('/api/referentiel/structures', data); }
  updateStructure(id: number, data: Partial<Structure> & { districtId: number }): Observable<Structure> { return this.http.put<Structure>(`/api/referentiel/structures/${id}`, data); }
  deleteStructure(id: number): Observable<void> { return this.http.delete<void>(`/api/referentiel/structures/${id}`); }

  // Programmes
  createProgramme(data: Partial<Programme>): Observable<Programme> { return this.http.post<Programme>('/api/referentiel/programmes', data); }
  updateProgramme(id: number, data: Partial<Programme>): Observable<Programme> { return this.http.put<Programme>(`/api/referentiel/programmes/${id}`, data); }
  deleteProgramme(id: number): Observable<void> { return this.http.delete<void>(`/api/referentiel/programmes/${id}`); }

  // Produits
  createProduit(data: { code: string; nom: string; unite: string; programmeId: number }): Observable<Produit> { return this.http.post<Produit>('/api/referentiel/produits', data); }
  updateProduit(id: number, data: Partial<Produit> & { programmeId: number }): Observable<Produit> { return this.http.put<Produit>(`/api/referentiel/produits/${id}`, data); }
  deleteProduit(id: number): Observable<void> { return this.http.delete<void>(`/api/referentiel/produits/${id}`); }

  // Utilisateurs
  getUtilisateurs(): Observable<UtilisateurDTO[]> { return this.http.get<UtilisateurDTO[]>('/api/admin/utilisateurs'); }
  createUtilisateur(data: any): Observable<UtilisateurDTO> { return this.http.post<UtilisateurDTO>('/api/admin/utilisateurs', data); }
  updateUtilisateur(id: number, data: any): Observable<UtilisateurDTO> { return this.http.put<UtilisateurDTO>(`/api/admin/utilisateurs/${id}`, data); }
  deleteUtilisateur(id: number): Observable<void> { return this.http.delete<void>(`/api/admin/utilisateurs/${id}`); }
  getRoles(): Observable<{ id: number; name: string }[]> { return this.http.get<{ id: number; name: string }[]>('/api/admin/roles'); }

  // Périodes (admin)
  createPeriode(dateRas: string, regionId: number): Observable<PeriodeSaisie> {
    return this.http.post<PeriodeSaisie>('/api/admin/periodes', { dateRas, regionId });
  }
  deletePeriodeAdmin(id: number): Observable<void> { return this.http.delete<void>(`/api/admin/periodes/${id}`); }
}
