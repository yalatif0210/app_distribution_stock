import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { PlanService } from '../../../core/services/plan.service';
import { LignePlan, PlanReattribution } from '../../../core/models/models';

/**
 * Version imprimable des plans de redéploiement, hors du cadre de l'application.
 *   /plans/impression?planId=12        un plan
 *   /plans/impression?periodeId=3      tous les plans de la période (brouillons exclus)
 *   &programmeId=…                     facultatif, limite à un programme
 * La boîte d'impression du navigateur s'ouvre une fois les plans chargés.
 */
@Component({
  selector: 'app-impression-plans',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display:block; background:#e2e8f0; min-height:100vh; padding:1.5rem 0; color:#0f172a;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
    .barre { max-width:1100px; margin:0 auto 1rem; padding:0 1rem; display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
    .barre button { font:inherit; font-size:.9rem; padding:.45rem 1rem; border-radius:.35rem; cursor:pointer;
                    border:1px solid #4f46e5; background:#4f46e5; color:#fff; }
    .barre button.secondaire { background:#fff; color:#4f46e5; }
    .barre .info { color:#475569; font-size:.85rem; margin-left:.5rem; }
    .page { max-width:1100px; margin:0 auto 1.5rem; background:#fff; padding:1.75rem 2rem; box-shadow:0 1px 3px rgba(0,0,0,.12); }
    h1 { font-size:1.25rem; margin:0 0 .25rem; }
    .sous-titre { color:#475569; font-size:.85rem; margin-bottom:1rem; }
    .meta { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:.5rem 1.25rem; font-size:.82rem;
            border:1px solid #cbd5e1; border-radius:.35rem; padding:.65rem .85rem; margin-bottom:1rem; }
    .meta div span { display:block; color:#64748b; font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
    .resume { font-size:.82rem; color:#334155; margin:0 0 1rem; white-space:pre-line; }
    table { width:100%; border-collapse:collapse; font-size:.76rem; }
    th, td { border:1px solid #94a3b8; padding:.3rem .4rem; vertical-align:top; text-align:left; }
    th { background:#f1f5f9; font-size:.68rem; text-transform:uppercase; letter-spacing:.03em; }
    td.num { text-align:right; font-family:ui-monospace, monospace; white-space:nowrap; }
    td.vide { min-width:5.5rem; }
    .total { margin-top:.6rem; font-size:.8rem; color:#334155; }
    .signatures { display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem; margin-top:2rem; font-size:.8rem; }
    .signatures div { border-top:1px solid #64748b; padding-top:.35rem; min-height:3.5rem; color:#475569; }
    .pied { margin-top:1.25rem; font-size:.7rem; color:#94a3b8; display:flex; justify-content:space-between; }
    .etat { max-width:1100px; margin:3rem auto; text-align:center; color:#475569; }
    @media print {
      :host { background:#fff; padding:0; }
      .barre { display:none; }
      .page { box-shadow:none; margin:0; max-width:none; padding:0; page-break-after:always; break-after:page; }
      .page:last-child { page-break-after:auto; break-after:auto; }
      tr { page-break-inside:avoid; break-inside:avoid; }
      thead { display:table-header-group; }
    }
    @page { size: A4 landscape; margin: 12mm; }
  `],
  template: `
    <div class="barre">
      <button type="button" (click)="imprimer()" [disabled]="chargement || plans.length === 0">Imprimer</button>
      <button type="button" class="secondaire" (click)="fermer()">Fermer</button>
      <span class="info" *ngIf="!chargement">{{ plans.length }} plan(s)</span>
    </div>

    <div class="etat" *ngIf="chargement">Préparation de l'impression…</div>
    <div class="etat" *ngIf="!chargement && erreur">{{ erreur }}</div>
    <div class="etat" *ngIf="!chargement && !erreur && plans.length === 0">Aucun plan à imprimer pour cette sélection.</div>

    <section class="page" *ngFor="let p of plans">
      <h1>Plan de redéploiement n° {{ p.id }}</h1>
      <div class="sous-titre">{{ p.programmeNom || 'Tous les programmes' }} · {{ p.regionNom }} · période du {{ p.periodeLibelle }}</div>

      <div class="meta">
        <div><span>Statut</span>{{ libelleStatut(p.statut) }}</div>
        <div><span>Construit</span>{{ p.genereParlA ? 'par l\\'analyse IA' : 'manuellement' }}, le {{ p.dateGeneration | date:'dd/MM/yyyy' }}</div>
        <div><span>Validé</span>{{ p.dateValidation ? ((p.dateValidation | date:'dd/MM/yyyy') + (p.valideParUsername ? ' par ' + p.valideParUsername : '')) : 'non validé' }}</div>
        <div><span>Avancement</span>{{ p.nbLignesExecutees }} / {{ p.nbLignes }} mouvement(s) exécuté(s) au moins en partie</div>
      </div>
      <p class="resume" *ngIf="p.resumeIa">{{ p.resumeIa }}</p>
      <p class="resume" *ngIf="p.notes">Notes : {{ p.notes }}</p>

      <table>
        <thead>
          <tr>
            <th>#</th><th>Produit</th><th>Unité</th><th>Site expéditeur</th><th>Site destinataire</th>
            <th>Quantité prévue</th><th>Quantité exécutée</th><th>Péremption (lot)</th><th>Statut</th>
            <th>Visa expédition</th><th>Visa réception</th><th>Observations</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let l of lignesTriees(p); let i = index">
            <td class="num">{{ i + 1 }}</td>
            <td><strong>{{ l.produitNom }}</strong><br><span style="color:#64748b;">{{ l.produitCode }}</span></td>
            <td>{{ l.produitUnite }}</td>
            <td>{{ l.structureSourceNom }}</td>
            <td>{{ l.structureCibleNom }}</td>
            <td class="num">{{ l.quantiteProposee | number:'1.0-2' }}</td>
            <td class="num">{{ l.quantiteExecutee ? (l.quantiteExecutee | number:'1.0-2') : '' }}</td>
            <td class="num">{{ l.expireDate ? (l.expireDate | date:'dd/MM/yyyy') : '' }}</td>
            <td>{{ libelleLigne(l.statut) }}</td>
            <td class="vide"></td><td class="vide"></td><td class="vide">{{ l.notes }}</td>
          </tr>
          <tr *ngIf="!p.lignes?.length"><td colspan="12" style="text-align:center;color:#64748b;">Aucun mouvement</td></tr>
        </tbody>
      </table>
      <div class="total">{{ p.lignes?.length || 0 }} mouvement(s).</div>

      <div class="signatures">
        <div>Le pharmacien de région</div>
        <div>Visa du responsable</div>
        <div>Date</div>
      </div>
      <div class="pied">
        <span>redistribution.lhspla-ci.org</span>
        <span>Imprimé le {{ maintenant | date:'dd/MM/yyyy à HH:mm' }}</span>
      </div>
    </section>
  `
})
export class ImpressionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private planService = inject(PlanService);

  plans: PlanReattribution[] = [];
  chargement = true;
  erreur = '';
  maintenant = new Date();

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const planId = Number(q.get('planId')) || null;
    const periodeId = Number(q.get('periodeId')) || null;
    const programmeId = Number(q.get('programmeId')) || null;

    const ids$ = planId
      ? of([planId])
      : periodeId
        ? this.planService.getPlans(periodeId).pipe(switchMap(liste => of(liste
            .filter(p => p.statut !== 'BROUILLON' && (!programmeId || p.programmeId === programmeId))
            .sort((a, b) => (a.programmeNom ?? '').localeCompare(b.programmeNom ?? '') || a.id - b.id)
            .map(p => p.id))))
        : of([] as number[]);

    ids$.pipe(switchMap(ids => ids.length ? forkJoin(ids.map(id => this.planService.getPlan(id))) : of([])))
      .subscribe({
        next: plans => {
          this.plans = plans;
          this.chargement = false;
          if (plans.length) setTimeout(() => window.print(), 400);
        },
        error: err => {
          this.chargement = false;
          this.erreur = err.error?.message || 'Impossible de charger les plans à imprimer.';
        }
      });
  }

  lignesTriees(p: PlanReattribution): LignePlan[] {
    return [...(p.lignes ?? [])].sort((a, b) =>
      (a.produitNom ?? '').localeCompare(b.produitNom ?? '') || (a.structureSourceNom ?? '').localeCompare(b.structureSourceNom ?? ''));
  }

  libelleStatut(s: string): string {
    return ({ BROUILLON: 'Brouillon', VALIDE: 'Validé', EN_COURS: 'En cours', CLOTURE: 'Clôturé' } as Record<string, string>)[s] ?? s;
  }

  libelleLigne(s: string): string {
    return ({ EN_ATTENTE: 'En attente', PARTIEL: 'Partiel', EXECUTE: 'Exécuté', ANNULE: 'Annulé' } as Record<string, string>)[s] ?? s;
  }

  imprimer(): void { window.print(); }

  fermer(): void { window.close(); }
}
