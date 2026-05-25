import { Component, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanService } from '../../../core/services/plan.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LignePlan, PeriodeSaisie, PlanReattribution } from '../../../core/models/models';

@Component({
  selector: 'app-suivi',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatDialogModule,
    MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <!-- Header -->
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <h1>Suivi d'exécution des plans</h1>
        <p>Consultez et mettez à jour l'avancement des plans de redistribution</p>
      </div>
      <a mat-raised-button color="primary" routerLink="/plans/generation" *ngIf="!auth.isAdmin()">
        <mat-icon>add</mat-icon> Nouveau plan
      </a>
    </div>

    <!-- Filters -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
        <mat-form-field appearance="fill" style="min-width:200px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedPeriodeId" (selectionChange)="charger()">
            <mat-option [value]="null">Toutes les périodes</mat-option>
            <mat-option *ngFor="let p of periodes" [value]="p.id">{{ p.libelle ?? (p.dateRas | date:'dd/MM/yyyy') }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="min-width:180px;">
          <mat-label>Statut</mat-label>
          <mat-select [(ngModel)]="selectedStatut" (selectionChange)="charger()">
            <mat-option value="">Tous les statuts</mat-option>
            <mat-option value="BROUILLON" *ngIf="!auth.isAdmin()">Brouillon</mat-option>
            <mat-option value="VALIDE">Validé</mat-option>
            <mat-option value="EN_COURS">En cours</mat-option>
            <mat-option value="CLOTURE">Clôturé</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Rechercher</mat-label>
          <input matInput [(ngModel)]="recherche" (input)="filtrerPlans()" placeholder="Région, programme…">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </mat-card-content>
    </mat-card>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement des plans…</span>
    </div>

    <!-- Plans list -->
    <ng-container *ngIf="!loading">
      <ng-container *ngFor="let plan of plansFiltres">
        <mat-card style="margin-bottom:1rem;cursor:pointer;" (click)="togglePlan(plan)">
          <mat-card-header style="padding:.875rem 1rem;">
            <mat-card-title style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;font-size:.95rem;font-weight:600;">
              <span>Plan #{{ plan.id }} — {{ plan.periodeLibelle }} · {{ plan.programmeNom }} · {{ plan.regionNom }}</span>
              <span [class]="statutBadgeClass(plan.statut)" style="font-size:.7rem;">{{ plan.statut }}</span>
              <span *ngIf="plan.genereParlA" style="background:rgba(56,189,248,.15);color:#38bdf8;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:.25rem;">IA</span>
              <span style="flex:1;"></span>
              <div style="display:flex;align-items:center;gap:.5rem;min-width:200px;">
                <mat-progress-bar mode="determinate" [value]="plan.progression" style="flex:1;" color="primary"></mat-progress-bar>
                <span style="color:var(--text-secondary);font-size:.75rem;white-space:nowrap;">{{ plan.nbLignesExecutees }}/{{ plan.nbLignes }}</span>
              </div>
              <mat-icon style="color:var(--text-secondary);font-size:20px;width:20px;height:20px;">
                {{ expandedPlanId === plan.id ? 'expand_less' : 'expand_more' }}
              </mat-icon>
            </mat-card-title>
          </mat-card-header>

          <!-- Expanded content -->
          <ng-container *ngIf="expandedPlanId === plan.id">
            <mat-card-content style="padding:0;" (click)="$event.stopPropagation()">
              <div *ngIf="plan.resumeIa" style="padding:.75rem 1rem;background:rgba(129,140,248,.05);border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color);font-size:.875rem;color:var(--text-secondary);">
                <mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle;margin-right:.4rem;color:var(--accent-color);">auto_awesome</mat-icon>
                <strong style="color:var(--text-primary);">Analyse IA :</strong> {{ plan.resumeIa }}
              </div>

              <div *ngIf="detailLoading[plan.id]" class="loading-overlay" style="height:120px;">
                <mat-spinner diameter="32"></mat-spinner>
              </div>

              <ng-container *ngIf="!detailLoading[plan.id] && planDetail[plan.id]">
                <div style="padding:.5rem 1rem .25rem;">
                  <mat-form-field appearance="outline" style="width:100%;">
                    <mat-label>Filtrer les lignes</mat-label>
                    <input matInput #fSuivi (input)="dsLignesSuivi.filter=fSuivi.value.trim().toLowerCase(); dsLignesSuivi.paginator?.firstPage()">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>
              <table mat-table [dataSource]="dsLignesSuivi" matSort #sortLignesSuivi="matSort" style="width:100%;">
                <ng-container matColumnDef="produit">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                  <td mat-cell *matCellDef="let l">
                    <div style="font-size:.875rem;font-weight:500;">{{ l.produitNom }}</div>
                    <div style="color:var(--text-secondary);font-size:.75rem;">{{ l.produitUnite }}</div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="mouvement">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Source → Destination</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.875rem;">{{ l.structureSourceNom }} → {{ l.structureCibleNom }}</td>
                </ng-container>
                <ng-container matColumnDef="propose">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Proposé</th>
                  <td mat-cell *matCellDef="let l" style="text-align:right;font-family:monospace;">{{ l.quantiteProposee | number:'1.0-0' }}</td>
                </ng-container>
                <ng-container matColumnDef="execute">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Exécuté</th>
                  <td mat-cell *matCellDef="let l" style="text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem;">
                      <mat-progress-bar mode="determinate" [value]="l.progression" style="width:60px;" [color]="l.statut === 'EXECUTE' ? 'primary' : 'accent'"></mat-progress-bar>
                      <span style="font-family:monospace;font-size:.875rem;">{{ l.quantiteExecutee | number:'1.0-0' }}</span>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="unite">
                  <th mat-header-cell *matHeaderCellDef>Unité</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.82rem;color:var(--text-secondary);">{{ l.produitUnite }}</td>
                </ng-container>
                <ng-container matColumnDef="statut">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
                  <td mat-cell *matCellDef="let l">
                    <span [class]="ligneBadgeClass(l.statut)" style="font-size:.7rem;">{{ l.statut }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef>Action</th>
                  <td mat-cell *matCellDef="let l">
                    <button
                      mat-stroked-button
                      color="primary"
                      *ngIf="!auth.isAdmin() && l.statut !== 'EXECUTE' && l.statut !== 'ANNULE' && plan.statut !== 'BROUILLON'"
                      (click)="openExecution(plan, l)"
                      style="font-size:.75rem;height:30px;padding:0 .75rem;"
                    >
                      <mat-icon style="font-size:14px;width:14px;height:14px;">edit</mat-icon> Mettre à jour
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['produit','mouvement','propose','execute','unite','statut','action']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['produit','mouvement','propose','execute','unite','statut','action'];"></tr>
              </table>
              <mat-paginator #pagLignesSuivi [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
              </ng-container>

              <div *ngIf="(plan.statut === 'BROUILLON' && (auth.isPharmacienRegion() || auth.isAdmin())) || (plan.statut !== 'BROUILLON' && auth.isAdmin())"
                   style="padding:.75rem 1rem;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:.5rem;">
                <a mat-stroked-button [routerLink]="['/plans', plan.id, 'edition']"
                  *ngIf="plan.statut === 'BROUILLON'">
                  <mat-icon>edit</mat-icon> Modifier
                </a>
                <button mat-stroked-button color="warn" (click)="supprimerPlan(plan)"
                  matTooltip="Supprimer ce plan">
                  <mat-icon>delete_outline</mat-icon> Supprimer
                </button>
              </div>
            </mat-card-content>
          </ng-container>
        </mat-card>
      </ng-container>

      <div *ngIf="plansFiltres.length === 0" style="text-align:center;padding:3rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;color:var(--text-secondary);">
        <mat-icon style="font-size:2.5rem;width:2.5rem;height:2.5rem;display:block;margin:0 auto .75rem;">assignment</mat-icon>
        {{ recherche ? 'Aucun plan correspond à la recherche.' : 'Aucun plan trouvé.' }}
        <a *ngIf="!recherche" routerLink="/plans/generation" style="color:var(--accent-color);text-decoration:none;margin-left:.25rem;">Générer un plan</a>
      </div>
    </ng-container>

    <!-- Execution dialog template -->
    <ng-template #execDialog>
      <h2 mat-dialog-title>Enregistrer l'exécution</h2>
      <mat-dialog-content style="min-width:360px;padding-top:.5rem;" *ngIf="execModal">
        <p style="color:var(--text-secondary);font-size:.875rem;margin:0 0 .5rem;">{{ execModal.ligne.produitNom }} — {{ execModal.ligne.structureSourceNom }} → {{ execModal.ligne.structureCibleNom }}</p>
        <p style="margin:0 0 1.25rem;font-size:.875rem;">Quantité proposée : <strong style="color:var(--accent-color);">{{ execModal.ligne.quantiteProposee }}</strong></p>
        <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
          <mat-label>Quantité exécutée</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="execQte">
        </mat-form-field>
        <mat-form-field appearance="fill" style="width:100%;">
          <mat-label>Notes</mat-label>
          <textarea matInput [(ngModel)]="execNotes" rows="2"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="closeExecDialog()">Annuler</button>
        <button
          mat-raised-button
          color="primary"
          (click)="enregistrerExecution()"
          [disabled]="execSaving || execQte == null"
        >
          <mat-spinner *ngIf="execSaving" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          Enregistrer
        </button>
      </mat-dialog-actions>
    </ng-template>
  `
})
export class SuiviComponent implements OnInit {
  @ViewChild('execDialog') execDialogRef!: TemplateRef<any>;
  @ViewChild('pagLignesSuivi') pagLignesSuivi?: MatPaginator;
  @ViewChild('sortLignesSuivi') sortLignesSuivi?: MatSort;

  periodes: PeriodeSaisie[] = [];
  plans: PlanReattribution[] = [];
  plansFiltres: PlanReattribution[] = [];
  planDetail: Record<number, PlanReattribution | undefined> = {};
  detailLoading: Record<number, boolean> = {};
  expandedPlanId: number | null = null;
  dsLignesSuivi = new MatTableDataSource<LignePlan>([]);
  selectedPeriodeId: number | null = null;
  selectedStatut = '';
  recherche = '';
  loading = false;
  execModal: { plan: PlanReattribution; ligne: LignePlan } | null = null;
  execQte: number | null = null;
  execNotes = '';
  execSaving = false;

  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  constructor(private planService: PlanService, private refService: ReferentielService, public auth: AuthService) {}

  ngOnInit(): void {
    this.refService.getPeriodes().subscribe(p => this.periodes = p);
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.planService.getPlans(this.selectedPeriodeId ?? undefined, this.selectedStatut || undefined).subscribe({
      next: p => {
        this.plans = this.auth.isAdmin() ? p.filter(x => x.statut !== 'BROUILLON') : p;
        this.filtrerPlans();
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  filtrerPlans(): void {
    const q = this.recherche.trim().toLowerCase();
    this.plansFiltres = q
      ? this.plans.filter(p =>
          (p.regionNom ?? '').toLowerCase().includes(q) ||
          (p.programmeNom ?? '').toLowerCase().includes(q) ||
          (p.periodeLibelle ?? '').toLowerCase().includes(q) ||
          (p.statut ?? '').toLowerCase().includes(q)
        )
      : [...this.plans];
  }

  togglePlan(plan: PlanReattribution): void {
    if (this.expandedPlanId === plan.id) {
      this.expandedPlanId = null;
      this.dsLignesSuivi.data = [];
      return;
    }
    this.expandedPlanId = plan.id;
    if (!this.planDetail[plan.id]) {
      this.detailLoading[plan.id] = true;
      this.planService.getPlan(plan.id).subscribe(detail => {
        this.planDetail[plan.id] = detail;
        this.dsLignesSuivi.data = detail.lignes ?? [];
        const idx = this.plans.findIndex(p => p.id === plan.id);
        if (idx >= 0) this.plans[idx] = { ...this.plans[idx], ...detail };
        this.detailLoading[plan.id] = false;
        setTimeout(() => {
          this.dsLignesSuivi.paginator = this.pagLignesSuivi ?? null;
          this.dsLignesSuivi.sort = this.sortLignesSuivi ?? null;
        }, 0);
      });
    } else {
      this.dsLignesSuivi.data = this.planDetail[plan.id]!.lignes ?? [];
      setTimeout(() => {
        this.dsLignesSuivi.paginator = this.pagLignesSuivi ?? null;
        this.dsLignesSuivi.sort = this.sortLignesSuivi ?? null;
      }, 0);
    }
  }

  supprimerPlan(plan: PlanReattribution): void {
    if (!confirm(`Supprimer définitivement le plan #${plan.id} (${plan.periodeLibelle} · ${plan.programmeNom}) ?`)) return;
    this.planService.supprimerPlan(plan.id).subscribe({
      next: () => {
        this.plans = this.plans.filter(p => p.id !== plan.id);
        this.filtrerPlans();
        this.snackBar.open('Plan supprimé.', 'OK', { duration: 2500 });
      },
      error: err => this.snackBar.open(err.error?.message || 'Erreur lors de la suppression.', 'Fermer', { duration: 4000 })
    });
  }

  openExecution(plan: PlanReattribution, ligne: LignePlan): void {
    this.execModal = { plan, ligne };
    this.execQte = ligne.quantiteProposee;
    this.execNotes = '';
    this.dialog.open(this.execDialogRef, { width: '440px', disableClose: false });
  }

  closeExecDialog(): void {
    this.dialog.closeAll();
    this.execModal = null;
  }

  enregistrerExecution(): void {
    const modal = this.execModal;
    if (!modal || this.execQte == null) return;
    this.execSaving = true;
    this.planService.executerLigne(modal.plan.id, modal.ligne.id, this.execQte, this.execNotes).subscribe({
      next: () => {
        delete this.planDetail[modal.plan.id];
        this.dialog.closeAll();
        this.execModal = null;
        this.execSaving = false;
        this.snackBar.open('Exécution enregistrée.', 'OK', { duration: 3000 });
        this.charger();
      },
      error: () => {
        this.execSaving = false;
        this.snackBar.open('Erreur lors de l\'enregistrement.', 'Fermer', { duration: 4000 });
      }
    });
  }

  statutBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      'BROUILLON': 'badge badge-surveiller',
      'VALIDE': 'badge badge-normal',
      'EN_COURS': 'badge badge-ouverte',
      'CLOTURE': 'badge badge-fermee'
    };
    return map[statut] ?? 'badge';
  }

  ligneBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      'EN_ATTENTE': 'badge badge-fermee',
      'PARTIEL': 'badge badge-surveiller',
      'EXECUTE': 'badge badge-normal',
      'ANNULE': 'badge badge-rupture'
    };
    return map[statut] ?? 'badge';
  }
}
