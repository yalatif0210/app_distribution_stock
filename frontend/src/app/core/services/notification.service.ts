import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AppNotification } from '../models/models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private countSubject = new BehaviorSubject<number>(0);
  count$ = this.countSubject.asObservable();

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>('/api/notifications');
  }

  refreshCount(): void {
    this.http.get<{ count: number }>('/api/notifications/count').subscribe(r => this.countSubject.next(r.count));
  }

  marquerLu(id: number): Observable<void> {
    return this.http.put<void>(`/api/notifications/${id}/lire`, {}).pipe(
      tap(() => this.refreshCount())
    );
  }

  marquerToutLu(): Observable<void> {
    return this.http.put<void>('/api/notifications/lire-tout', {}).pipe(
      tap(() => this.countSubject.next(0))
    );
  }
}
