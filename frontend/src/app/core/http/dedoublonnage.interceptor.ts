import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable, catchError, finalize, share, tap, throwError } from 'rxjs';

/**
 * Idempotence des écritures (POST, PUT, DELETE, PATCH).
 *
 * 1. Requête identique déjà en cours (double clic) : elle n'est pas renvoyée, le second
 *    appel reçoit la réponse du premier.
 * 2. Chaque action porte une clé UUID (en-tête Idempotency-Key). Le serveur mémorise la
 *    réponse : si la même clé revient, il la renvoie sans refaire l'action.
 * 3. Si une tentative n'a pas reçu de réponse claire (coupure réseau, passerelle indisponible),
 *    la même action relancée dans les 10 minutes réutilise la même clé : le serveur
 *    reconnaît l'action si elle avait en fait abouti. Après une réponse claire, la clé est
 *    oubliée, et refaire la même action plus tard est une nouvelle action.
 */
const enCours = new Map<string, Observable<HttpEvent<unknown>>>();
const clesARejouer = new Map<string, { cle: string; expire: number }>();
const DUREE_REJEU_MS = 10 * 60 * 1000;

function signature(req: HttpRequest<unknown>): string | null {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return null;
  let corps: string;
  if (req.body instanceof FormData) {
    const champs: string[] = [];
    req.body.forEach((v, k) => champs.push(k + '=' + (v instanceof File ? `${v.name}:${v.size}:${v.lastModified}` : String(v))));
    corps = champs.join('&');
  } else {
    try { corps = JSON.stringify(req.body ?? null); } catch { return null; }
  }
  return `${req.method} ${req.urlWithParams} ${corps}`;
}

/** UUID v4. crypto.randomUUID n'existe qu'en HTTPS ou sur localhost : repli sur getRandomValues. */
function nouvelUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const o = crypto.getRandomValues(new Uint8Array(16));
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = [...o].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function cleIdempotence(sig: string): string {
  const now = Date.now();
  for (const [k, v] of clesARejouer) if (v.expire < now) clesARejouer.delete(k);
  return clesARejouer.get(sig)?.cle ?? nouvelUuid();
}

/** Pas de réponse exploitable : l'action a peut-être abouti côté serveur. */
function sansReponseClaire(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504);
}

export const dedoublonnageInterceptor: HttpInterceptorFn = (req, next) => {
  const sig = signature(req);
  if (sig === null) return next(req);

  const existant = enCours.get(sig);
  if (existant) return existant;

  const cle = cleIdempotence(sig);
  const partage = next(req.clone({ setHeaders: { 'Idempotency-Key': cle } })).pipe(
    tap({ complete: () => clesARejouer.delete(sig) }),
    catchError(err => {
      if (sansReponseClaire(err)) clesARejouer.set(sig, { cle, expire: Date.now() + DUREE_REJEU_MS });
      else clesARejouer.delete(sig);
      return throwError(() => err);
    }),
    finalize(() => enCours.delete(sig)),
    share()
  );
  enCours.set(sig, partage);
  return partage;
};
