import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StructureProgramme } from '../models/models';

export interface StructureProgrammeCreateRequest {
  structureId: number;
  programmeId: number;
  actif: boolean;
}

@Injectable({ providedIn: 'root' })
export class StructureProgrammeService {
  constructor(private http: HttpClient) {}

  findByRegion(regionId?: number): Observable<StructureProgramme[]> {
    let params = new HttpParams();
    if (regionId != null) {
      params = params.set('regionId', regionId);
    }
    return this.http.get<StructureProgramme[]>('/api/structure-programme', { params });
  }

  createOrActivate(req: StructureProgrammeCreateRequest): Observable<StructureProgramme> {
    return this.http.post<StructureProgramme>('/api/structure-programme', req);
  }

  update(id: number, actif: boolean): Observable<StructureProgramme> {
    return this.http.put<StructureProgramme>(`/api/structure-programme/${id}`, { actif });
  }
}
