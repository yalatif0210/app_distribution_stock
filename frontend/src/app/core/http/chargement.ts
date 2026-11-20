import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

/**
 * Requête de fond (enregistrement automatique, compteur de notifications) : elle ne doit
 * pas couvrir l'écran du voile de chargement.
 */
export const SANS_VOILE = new HttpContextToken<boolean>(() => false);

/** Contexte à passer aux requêtes de fond : `{ context: sansVoile() }`. */
export function sansVoile(): HttpContext {
  return new HttpContext().set(SANS_VOILE, true);
}

/** Délai avant d'afficher le voile : une réponse rapide ne fait rien clignoter. */
const DELAI_MS = 250;

/** Compte les requêtes en cours et décide de l'affichage du voile de chargement. */
@Injectable({ providedIn: 'root' })
export class ChargementService {
  private enCours = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private readonly visibleSig = signal(false);
  readonly visible = computed(() => this.visibleSig());

  debut(): void {
    this.enCours++;
    if (this.enCours === 1 && !this.minuterie) {
      this.minuterie = setTimeout(() => {
        this.minuterie = null;
        if (this.enCours > 0) this.visibleSig.set(true);
      }, DELAI_MS);
    }
  }

  fin(): void {
    this.enCours = Math.max(0, this.enCours - 1);
    if (this.enCours === 0) {
      if (this.minuterie) { clearTimeout(this.minuterie); this.minuterie = null; }
      this.visibleSig.set(false);
    }
  }
}

/** Toute requête HTTP, sauf celles marquées SANS_VOILE, alimente le voile de chargement. */
export const chargementInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SANS_VOILE)) return next(req);
  const chargement = inject(ChargementService);
  chargement.debut();
  return next(req).pipe(finalize(() => chargement.fin()));
};
