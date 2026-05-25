import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompletudeDTO } from '../models/models';

export interface RelanceRequest {
  periodeId: number;
  programmeId: number;
  structureIds: number[];
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class CompletudeService {
  constructor(private http: HttpClient) {}

  getCompletude(periodeId: number, programmeId: number, regionId?: number): Observable<CompletudeDTO> {
    let params = new HttpParams()
      .set('periodeId', periodeId)
      .set('programmeId', programmeId);
    if (regionId != null) {
      params = params.set('regionId', regionId);
    }
    return this.http.get<CompletudeDTO>('/api/completude', { params });
  }

  relancer(req: RelanceRequest): Observable<void> {
    return this.http.post<void>('/api/completude/relancer', req);
  }
}
