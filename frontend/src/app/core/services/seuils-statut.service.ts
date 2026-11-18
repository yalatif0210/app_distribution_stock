import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

/** Seuils de MSD (en mois) qui donnent le statut qualitatif d'un stock. Administrés par l'admin. */
export interface SeuilsStatut {
  tension: number;
  surveiller: number;
  surstock: number;
}

@Injectable({ providedIn: 'root' })
export class SeuilsStatutService {
  private http = inject(HttpClient);
  private chargement$?: Observable<SeuilsStatut>;

  /** Valeurs par défaut affichées tant que le serveur n'a pas répondu. */
  seuils: SeuilsStatut = { tension: 1, surveiller: 2, surstock: 4 };

  charger(): Observable<SeuilsStatut> {
    if (!this.chargement$) {
      this.chargement$ = this.http.get<SeuilsStatut>('/api/parametres/statuts').pipe(
        tap(s => this.seuils = s),
        shareReplay(1)
      );
      this.chargement$.subscribe({ error: () => this.chargement$ = undefined });
    }
    return this.chargement$;
  }

  modifier(seuils: SeuilsStatut): Observable<SeuilsStatut> {
    return this.http.put<SeuilsStatut>('/api/parametres/statuts', seuils).pipe(
      tap(s => { this.seuils = s; this.chargement$ = undefined; })
    );
  }

  /** Couleur d'un MSD, cohérente avec les statuts calculés par le serveur. */
  couleurMsd(msd: number): string {
    this.charger();
    const s = this.seuils;
    if (msd === 0) return '#dc2626';
    if (msd < s.tension) return '#ea580c';
    if (msd < s.surveiller) return '#d97706';
    if (msd <= s.surstock) return '#16a34a';
    return '#7c3aed';
  }
}
