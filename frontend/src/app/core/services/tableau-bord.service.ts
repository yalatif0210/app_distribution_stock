import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TableauBordDTO } from '../models/models';

@Injectable({ providedIn: 'root' })
export class TableauBordService {
  constructor(private http: HttpClient) {}

  getTableauBord(
    periodeId: number,
    programmeId: number,
    planId: number,
    regionId?: number
  ): Observable<TableauBordDTO> {
    let params = new HttpParams()
      .set('periodeId', periodeId)
      .set('programmeId', programmeId)
      .set('planId', planId);
    if (regionId != null) {
      params = params.set('regionId', regionId);
    }
    return this.http.get<TableauBordDTO>('/api/tableau-bord', { params });
  }
}
