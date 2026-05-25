import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AuthResponse | null>(this.loadUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { username, password }).pipe(
      tap(res => {
        localStorage.setItem('auth', JSON.stringify(res));
        this.currentUserSubject.next(res);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('auth');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  get token(): string | null { return this.currentUserSubject.value?.token ?? null; }
  get role(): string | null { return this.currentUserSubject.value?.role ?? null; }
  get regionId(): number | null { return this.currentUserSubject.value?.regionId ?? null; }
  get structureId(): number | null { return this.currentUserSubject.value?.structureId ?? null; }
  get isLoggedIn(): boolean { return !!this.currentUserSubject.value; }
  get currentUser(): AuthResponse | null { return this.currentUserSubject.value; }

  isAdmin(): boolean { return this.role === 'ADMIN'; }
  isSuperviseur(): boolean { return this.role === 'SUPERVISEUR'; }
  isGestionnaire(): boolean { return this.role === 'GESTIONNAIRE'; }
  isPharmacienRegion(): boolean { return this.role === 'PHARMACIEN_REGION' || this.isAdmin(); }
  get supervisedRegionIds(): number[] { return this.currentUserSubject.value?.supervisedRegionIds ?? []; }

  get contextLabel(): string {
    if (this.isGestionnaire()) return this.currentUserSubject.value?.structureNom ?? '';
    if (this.isPharmacienRegion() && !this.isAdmin()) return this.currentUserSubject.value?.regionNom ?? '';
    return '';
  }

  private loadUser(): AuthResponse | null {
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : null;
  }
}
