import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import Chart from 'chart.js/auto';
import { AuthService } from '../../core/auth/auth.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { FiltreStatistiques, Statistiques, StatistiquesService } from '../../core/services/statistiques.service';
import { Programme, Region } from '../../core/models/models';

/**
 * Statistiques des plans de redéploiement validés sur une plage de dates (date de validation),
 * au niveau d'une région, du périmètre du superviseur ou national (admin). Export Excel et PDF.
 */
@Component({
  selector: 'app-statistiques',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
            MatSnackBarModule, MatTooltipModule],
  styles: [`
    .filtres { display:flex; flex-wrap:wrap; gap:.75rem 1rem; align-items:flex-end; padding:1rem;
               border:1px solid var(--border-color); border-radius:.5rem; background:var(--surface-color, #fff); margin-bottom:1.25rem; }
    .champ { display:flex; flex-direction:column; gap:.25rem; min-width:150px; }
    .champ label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary); }
    .champ input, .champ select { height:2.25rem; padding:0 .6rem; border:1px solid #cbd5e1; border-radius:.35rem;
               font:inherit; font-size:.9rem; background:#fff; color:var(--text-primary); }
    .actions { display:flex; gap:.5rem; flex-wrap:wrap; margin-left:auto; }
    .entete { display:flex; flex-wrap:wrap; gap:.25rem 1rem; align-items:baseline; margin-bottom:1rem; }
    .entete h2 { margin:0; font-size:1.05rem; }
    .entete span { color:var(--text-secondary); font-size:.85rem; }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:.75rem; margin-bottom:1.25rem; }
    .kpi { border:1px solid var(--border-color); border-radius:.5rem; padding:.9rem 1rem; background:var(--surface-color, #fff); }
    .kpi .titre { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-secondary); }
    .kpi .valeur { font-size:1.6rem; font-weight:800; margin:.3rem 0 .15rem; color:var(--text-primary); }
    .kpi .detail { font-size:.76rem; color:var(--text-secondary); line-height:1.4; }
    .bloc { border:1px solid var(--border-color); border-radius:.5rem; background:var(--surface-color, #fff); margin-bottom:1.25rem; overflow:hidden; }
    .bloc h3 { margin:0; padding:.7rem 1rem; font-size:.85rem; border-bottom:1px solid var(--border-color); background:rgba(79,70,229,.04); }
    .defile { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:.83rem; }
    th { text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary);
         padding:.5rem .75rem; border-bottom:1px solid var(--border-color); white-space:nowrap; }
    td { padding:.45rem .75rem; border-bottom:1px solid var(--border-color); }
    .num { text-align:right; font-family:ui-monospace, monospace; white-space:nowrap; }
    .deux { display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:1.25rem; }
    .deux .bloc { margin-bottom:0; }
    .vide { padding:2.5rem 1rem; text-align:center; color:var(--text-secondary); }
    @media (max-width: 600px) { .actions { margin-left:0; } .deux { grid-template-columns:1fr; } }
  `],
  template: `
    <div class="page-header">
      <h1>Statistiques des plans</h1>
      <p>Plans de redéploiement validés sur une période, au niveau {{ auth.isAdmin() ? 'national ou régional' : auth.isSuperviseur() ? 'de votre périmètre ou d\\'une région' : 'de votre région' }}</p>
    </div>

    <div class="filtres">
      <div class="champ">
        <label for="st-debut">Validés du</label>
        <input id="st-debut" type="date" [(ngModel)]="debut" [max]="fin">
      </div>
      <div class="champ">
        <label for="st-fin">au</label>
        <input id="st-fin" type="date" [(ngModel)]="fin" [min]="debut">
      </div>
      <div class="champ" *ngIf="!auth.isPharmacienRegion() || auth.isAdmin()" style="min-width:220px;">
        <label for="st-niveau">Niveau</label>
        <select id="st-niveau" [(ngModel)]="regionId">
          <option [ngValue]="null">{{ auth.isAdmin() ? 'National (toutes les régions)' : 'Tout mon périmètre' }}</option>
          <option *ngFor="let r of regions" [ngValue]="r.id">{{ r.nom }}</option>
        </select>
      </div>
      <div class="champ" style="min-width:220px;">
        <label for="st-programme">Programme</label>
        <select id="st-programme" [(ngModel)]="programmeId">
          <option [ngValue]="null">Tous les programmes</option>
          <option *ngFor="let p of programmes" [ngValue]="p.id">{{ p.nom }}</option>
        </select>
      </div>
      <button mat-raised-button color="primary" (click)="calculer()" [disabled]="chargement || !debut || !fin">
        <mat-icon>query_stats</mat-icon> Calculer
      </button>
      <div class="actions">
        <button mat-stroked-button (click)="exporter('excel')" [disabled]="!stats || export !== null">
          <mat-icon>table_view</mat-icon> {{ export === 'excel' ? 'Export…' : 'Excel' }}
        </button>
        <button mat-stroked-button (click)="exporter('pdf')" [disabled]="!stats || export !== null">
          <mat-icon>picture_as_pdf</mat-icon> {{ export === 'pdf' ? 'Export…' : 'PDF' }}
        </button>
      </div>
    </div>

    <div *ngIf="chargement" class="vide"><mat-spinner diameter="40" style="margin:0 auto .75rem;"></mat-spinner>Calcul en cours…</div>

    <ng-container *ngIf="!chargement && stats as s">
      <div class="entete">
        <h2>{{ s.niveau }}</h2>
        <span>Plans validés du {{ s.debut | date:'dd/MM/yyyy' }} au {{ s.fin | date:'dd/MM/yyyy' }} · {{ s.programme }}</span>
      </div>

      <div *ngIf="s.synthese.nbPlans === 0" class="bloc vide">Aucun plan validé sur cette période.</div>

      <ng-container *ngIf="s.synthese.nbPlans > 0">
        <div class="kpis">
          <div class="kpi">
            <div class="titre">Plans validés</div>
            <div class="valeur">{{ s.synthese.nbPlans }}</div>
            <div class="detail">dont {{ s.synthese.nbPlansClotures }} clôturé(s) · {{ s.synthese.nbRegions }} région(s)</div>
          </div>
          <div class="kpi">
            <div class="titre">Mouvements</div>
            <div class="valeur">{{ s.synthese.nbMouvements }}</div>
            <div class="detail">{{ s.synthese.nbExecutes }} exécuté(s) · {{ s.synthese.nbPartiels }} partiel(s) · {{ s.synthese.nbEnAttente }} en attente</div>
          </div>
          <div class="kpi" matTooltip="Mouvements exécutés au moins en partie / mouvements">
            <div class="titre">Exécution des mouvements</div>
            <div class="valeur">{{ s.synthese.tauxExecutionMouvements | number:'1.0-1' }} %</div>
            <div class="detail">exécutés au moins en partie</div>
          </div>
          <div class="kpi" matTooltip="Quantités exécutées / quantités prévues">
            <div class="titre">Exécution des quantités</div>
            <div class="valeur">{{ s.synthese.tauxExecutionQuantites | number:'1.0-1' }} %</div>
            <div class="detail">quantités livrées / prévues</div>
          </div>
          <div class="kpi" matTooltip="Jours entre la validation du plan et l'exécution du mouvement">
            <div class="titre">Délai d'exécution</div>
            <div class="valeur">{{ s.synthese.delaiMoyenJours !== null ? (s.synthese.delaiMoyenJours | number:'1.0-1') + ' j' : '-' }}</div>
            <div class="detail">en moyenne · médiane {{ s.synthese.delaiMedianJours !== null ? (s.synthese.delaiMedianJours | number:'1.0-1') + ' j' : '-' }}</div>
          </div>
          <div class="kpi" matTooltip="Sites en rupture avant le plan qui ont reçu le produit">
            <div class="titre">Ruptures résorbées</div>
            <div class="valeur">{{ s.synthese.nbRupturesResorbees }}</div>
            <div class="detail">{{ s.synthese.nbCiblesServies }} destinataire(s) servi(s) au total</div>
          </div>
        </div>

        <div class="bloc" *ngIf="s.parMois.length > 0">
          <h3>Évolution par mois de validation</h3>
          <div style="position:relative;height:280px;padding:.75rem 1rem;"><canvas id="statMoisChart"></canvas></div>
        </div>

        <div class="bloc" *ngIf="s.parRegion.length > 1">
          <h3>Par région</h3>
          <div class="defile"><table>
            <thead><tr><th>Région</th><th class="num">Plans</th><th class="num">Mouvements</th><th class="num">Exécution mouvements</th><th class="num">Exécution quantités</th><th class="num">Ruptures résorbées</th></tr></thead>
            <tbody><tr *ngFor="let g of s.parRegion">
              <td>{{ g.libelle }}</td><td class="num">{{ g.nbPlans }}</td><td class="num">{{ g.nbMouvements }}</td>
              <td class="num">{{ g.tauxExecutionMouvements | number:'1.0-1' }} %</td><td class="num">{{ g.tauxExecutionQuantites | number:'1.0-1' }} %</td>
              <td class="num">{{ g.nbRupturesResorbees }}</td>
            </tr></tbody>
          </table></div>
        </div>

        <div class="bloc">
          <h3>Par programme</h3>
          <div class="defile"><table>
            <thead><tr><th>Programme</th><th class="num">Plans</th><th class="num">Mouvements</th><th class="num">Exécution mouvements</th><th class="num">Exécution quantités</th><th class="num">Ruptures résorbées</th></tr></thead>
            <tbody><tr *ngFor="let g of s.parProgramme">
              <td>{{ g.libelle }}</td><td class="num">{{ g.nbPlans }}</td><td class="num">{{ g.nbMouvements }}</td>
              <td class="num">{{ g.tauxExecutionMouvements | number:'1.0-1' }} %</td><td class="num">{{ g.tauxExecutionQuantites | number:'1.0-1' }} %</td>
              <td class="num">{{ g.nbRupturesResorbees }}</td>
            </tr></tbody>
          </table></div>
        </div>

        <div class="bloc">
          <h3>Quantités redistribuées par produit</h3>
          <div class="defile"><table>
            <thead><tr><th>Programme</th><th>Produit</th><th>Unité</th><th class="num">Mouvements</th><th class="num">Prévu</th><th class="num">Exécuté</th><th class="num">Exécution</th></tr></thead>
            <tbody><tr *ngFor="let p of s.parProduit">
              <td>{{ p.programme }}</td><td><strong>{{ p.nom }}</strong> <span style="color:var(--text-secondary);font-size:.75rem;">{{ p.code }}</span></td>
              <td>{{ p.unite }}</td><td class="num">{{ p.nbMouvements }}</td>
              <td class="num">{{ p.quantitePrevue | number:'1.0-1' }}</td><td class="num">{{ p.quantiteExecutee | number:'1.0-1' }}</td>
              <td class="num">{{ p.tauxExecutionQuantites | number:'1.0-1' }} %</td>
            </tr></tbody>
          </table></div>
        </div>

        <div class="deux">
          <div class="bloc">
            <h3>Sites expéditeurs les plus sollicités</h3>
            <div class="defile"><table>
              <thead><tr><th>Site</th><th *ngIf="s.parRegion.length > 1">Région</th><th class="num">Mouvements</th><th class="num">Exécutés</th><th class="num">Produits</th></tr></thead>
              <tbody><tr *ngFor="let x of s.sitesSources">
                <td>{{ x.nom }}</td><td *ngIf="s.parRegion.length > 1">{{ x.region }}</td><td class="num">{{ x.nbMouvements }}</td>
                <td class="num">{{ x.nbExecutesAuMoinsEnPartie }}</td><td class="num">{{ x.nbProduits }}</td>
              </tr></tbody>
            </table></div>
          </div>
          <div class="bloc">
            <h3>Sites destinataires les plus servis</h3>
            <div class="defile"><table>
              <thead><tr><th>Site</th><th *ngIf="s.parRegion.length > 1">Région</th><th class="num">Mouvements</th><th class="num">Exécutés</th><th class="num">Ruptures résorbées</th></tr></thead>
              <tbody><tr *ngFor="let x of s.sitesCibles">
                <td>{{ x.nom }}</td><td *ngIf="s.parRegion.length > 1">{{ x.region }}</td><td class="num">{{ x.nbMouvements }}</td>
                <td class="num">{{ x.nbExecutesAuMoinsEnPartie }}</td><td class="num">{{ x.nbRupturesResorbees }}</td>
              </tr></tbody>
            </table></div>
          </div>
        </div>
      </ng-container>
    </ng-container>

    <div *ngIf="!chargement && !stats" class="bloc vide">
      Choisissez une période de validation, puis « Calculer ».
    </div>
  `
})
export class StatistiquesComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private service = inject(StatistiquesService);
  private refService = inject(ReferentielService);
  private snackBar = inject(MatSnackBar);

  debut = `${new Date().getFullYear()}-01-01`;
  fin = new Date().toISOString().slice(0, 10);
  regionId: number | null = null;
  programmeId: number | null = null;
  regions: Region[] = [];
  programmes: Programme[] = [];

  stats: Statistiques | null = null;
  chargement = false;
  export: 'excel' | 'pdf' | null = null;
  private graphe: Chart | null = null;

  ngOnInit(): void {
    if (this.auth.isAdmin() || this.auth.isSuperviseur()) {
      this.refService.getRegions().subscribe(r => this.regions = r);
    }
    this.refService.getProgrammesGeres().subscribe(p => this.programmes = p);
    this.calculer();
  }

  ngOnDestroy(): void {
    this.graphe?.destroy();
  }

  private get filtre(): FiltreStatistiques {
    return { debut: this.debut, fin: this.fin, regionId: this.regionId, programmeId: this.programmeId };
  }

  calculer(): void {
    if (!this.debut || !this.fin) return;
    this.chargement = true;
    this.service.calculer(this.filtre).subscribe({
      next: s => {
        this.stats = s;
        this.chargement = false;
        setTimeout(() => this.dessiner(), 50);
      },
      error: err => {
        this.chargement = false;
        this.snackBar.open(err.error?.message || 'Calcul des statistiques impossible.', 'Fermer', { duration: 5000 });
      }
    });
  }

  exporter(format: 'excel' | 'pdf'): void {
    this.export = format;
    this.service.exporter(this.filtre, format).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statistiques_plans_${this.debut.replaceAll('-', '')}_${this.fin.replaceAll('-', '')}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        URL.revokeObjectURL(url);
        this.export = null;
      },
      error: () => {
        this.export = null;
        this.snackBar.open('Export impossible.', 'Fermer', { duration: 4000 });
      }
    });
  }

  /** Mouvements par mois (barres) et taux d'exécution (courbe). */
  private dessiner(): void {
    this.graphe?.destroy();
    this.graphe = null;
    const ctx = document.getElementById('statMoisChart') as HTMLCanvasElement;
    if (!ctx || !this.stats) return;
    const mois = this.stats.parMois;
    this.graphe = new Chart(ctx, {
      data: {
        labels: mois.map(m => m.libelle),
        datasets: [
          { type: 'bar', label: 'Mouvements', data: mois.map(m => m.nbMouvements), backgroundColor: 'rgba(79,70,229,.55)', yAxisID: 'y' },
          { type: 'line', label: 'Exécution des mouvements (%)', data: mois.map(m => m.tauxExecutionMouvements),
            borderColor: '#16a34a', backgroundColor: '#16a34a', tension: .3, yAxisID: 'taux' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Mouvements' }, ticks: { precision: 0 } },
          taux: { position: 'right', min: 0, max: 100, title: { display: true, text: '%' }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }
}
