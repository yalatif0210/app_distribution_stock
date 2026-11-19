import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
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
        this.profilVerifie$ = of(true);   // profil tout juste lu à la connexion
      })
    );
  }

  private profilVerifie$: Observable<boolean> | null = null;

  /**
   * Relit une fois par chargement de l'application le profil à jour (rôle, structure, région) :
   * un rattachement modifié depuis la connexion est pris en compte sans se reconnecter.
   * Un compte supprimé, désactivé ou une session expirée renvoie vers la connexion.
   */
  verifierProfil(): Observable<boolean> {
    if (!this.currentUserSubject.value) return of(false);
    if (!this.profilVerifie$) {
      this.profilVerifie$ = this.http.get<AuthResponse>('/api/auth/moi').pipe(
        tap(profil => {
          const courant = this.currentUserSubject.value;
          if (!courant) return;
          const majour: AuthResponse = { ...courant, ...profil, token: courant.token };
          localStorage.setItem('auth', JSON.stringify(majour));
          this.currentUserSubject.next(majour);
        }),
        map(() => true),
        catchError(err => {
          if (err?.status === 401 || err?.status === 403) {
            this.profilVerifie$ = null;
            this.logout();
            return of(false);
          }
          return of(true);          // serveur injoignable : on garde la session telle quelle
        }),
        shareReplay(1)
      );
    }
    return this.profilVerifie$;
  }

  logout(): void {
    this.profilVerifie$ = null;
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
