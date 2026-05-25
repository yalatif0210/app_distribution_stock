import { Component, OnInit, AfterViewInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PeriodeService } from '../../core/services/periode.service';
import { AuthService } from '../../core/auth/auth.service';
import { PeriodeSaisie } from '../../core/models/models';

@Component({
  selector: 'app-periodes',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule, MatDialogModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <!-- Page header -->
    <div class="page-header" style="display:flex; align-items:flex-start; justify-content:space-between;">
      <div>
        <h1>Gestion des périodes</h1>
        <p>Gérez les périodes de saisie de stocks par région</p>
      </div>
      <button mat-raised-button color="primary" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon> Nouvelle période
      </button>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement des périodes…</span>
    </div>

    <!-- Table card -->
    <mat-card *ngIf="!loading">
      <mat-card-content>
        <div style="padding:.5rem 0 .5rem;">
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Filtrer les périodes</mat-label>
            <input matInput #fPeriodes (input)="dataSource.filter=fPeriodes.value.trim().toLowerCase(); dataSource.paginator?.firstPage()">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>
        <table mat-table [dataSource]="dataSource" matSort style="width:100%;">

          <!-- Libellé -->
          <ng-container matColumnDef="libelle">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date RAS</th>
            <td mat-cell *matCellDef="let p" style="font-weight:600;">
              {{ formatDate(p.dateRas) }}
            </td>
          </ng-container>

          <!-- Date RAS -->
          <ng-container matColumnDef="dateRas">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date RAS</th>
            <td mat-cell *matCellDef="let p">{{ formatDate(p.dateRas) }}</td>
          </ng-container>

          <!-- Statut -->
          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
            <td mat-cell *matCellDef="let p">
              <span [class]="'badge badge-' + p.statut.toLowerCase()">{{ p.statut }}</span>
            </td>
          </ng-container>

          <!-- Région -->
          <ng-container matColumnDef="region">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Région</th>
            <td mat-cell *matCellDef="let p">{{ p.regionNom || '-' }}</td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
            <td mat-cell *matCellDef="let p" style="text-align:right;">
              <div class="table-actions" style="justify-content:flex-end;">
                <ng-container *ngIf="actionLoading === p.id; else actionBtns">
                  <mat-spinner diameter="22"></mat-spinner>
                </ng-container>
                <ng-template #actionBtns>
                  <button mat-stroked-button color="primary" *ngIf="p.statut === 'FERMEE'"
                          (click)="rouvrir(p)" matTooltip="Réouvrir la période">
                    <mat-icon>lock_open</mat-icon> Rouvrir
                  </button>
                  <button mat-stroked-button color="warn" *ngIf="p.statut === 'OUVERTE'"
                          (click)="fermer(p)" matTooltip="Fermer la période">
                    <mat-icon>lock</mat-icon> Fermer
                  </button>
                  <button mat-icon-button color="warn" (click)="supprimer(p)"
                          matTooltip="Supprimer la période (impossible si plan validé existe)">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                  </button>
                </ng-template>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

          <!-- Empty -->
          <tr class="mat-row" *matNoDataRow>
            <td [attr.colspan]="displayedColumns.length" style="text-align:center; padding:2rem; color:var(--text-secondary);">
              <mat-icon style="font-size:2rem;width:2rem;height:2rem;display:block;margin:0 auto .5rem;">calendar_today</mat-icon>
              Aucune période trouvée
            </td>
          </tr>
        </table>

        <mat-paginator [pageSizeOptions]="[5, 10, 25]" [pageSize]="10" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>

    <!-- Create dialog template -->
    <ng-template #createDialog>
      <h2 mat-dialog-title>Nouvelle période</h2>
      <mat-dialog-content style="padding-top:.5rem; min-width:320px;">
        <p style="color:var(--text-secondary); font-size:.875rem; margin:0 0 1rem;">
          Saisissez la date du Rapport d'Analyse de Stock (RAS). Le mois et l'année seront déduits automatiquement.
        </p>
        <mat-form-field appearance="fill" style="width:100%;">
          <mat-label>Date RAS</mat-label>
          <input matInput type="date" [(ngModel)]="selectedDate" [max]="todayStr">
          <mat-icon matSuffix>event</mat-icon>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Annuler</button>
        <button
          mat-raised-button
          color="primary"
          (click)="createPeriode()"
          [disabled]="!selectedDate || createLoading"
        >
          <mat-spinner *ngIf="createLoading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          Créer
        </button>
      </mat-dialog-actions>
    </ng-template>
  `
})
export class PeriodesComponent implements OnInit, AfterViewInit {
  @ViewChild('createDialog') createDialogRef!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<PeriodeSaisie>([]);
  loading = false;
  actionLoading: number | null = null;
  selectedDate: string = '';
  createLoading = false;
  todayStr = new Date().toISOString().split('T')[0];
  regionNom: string | null = null;

  displayedColumns = ['libelle', 'dateRas', 'statut', 'region', 'actions'];

  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  constructor(private periodeService: PeriodeService, public auth: AuthService) {}

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  load(): void {
    this.loading = true;
    this.periodeService.findByRegion().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        if (data.length > 0 && data[0].regionNom) {
          this.regionNom = data[0].regionNom;
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Impossible de charger les périodes.', 'Fermer', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  openCreateDialog(): void {
    this.selectedDate = '';
    this.dialog.open(this.createDialogRef, { width: '440px', disableClose: false });
  }

  createPeriode(): void {
    if (!this.selectedDate) return;
    this.createLoading = true;
    this.periodeService.createPeriode(this.selectedDate).subscribe({
      next: (p) => {
        this.dataSource.data = [p, ...this.dataSource.data];
        this.createLoading = false;
        this.dialog.closeAll();
        this.snackBar.open(`Période ${p.libelle ?? p.dateRas} créée avec succès.`, 'OK', { duration: 4000 });
      },
      error: () => {
        this.snackBar.open('La création de la période a échoué.', 'Fermer', { duration: 4000 });
        this.createLoading = false;
      }
    });
  }

  rouvrir(periode: PeriodeSaisie): void {
    this.actionLoading = periode.id;
    this.periodeService.rouvrirPeriode(periode.id).subscribe({
      next: () => {
        periode.statut = 'OUVERTE';
        this.actionLoading = null;
        this.snackBar.open(`La période ${periode.libelle ?? periode.dateRas} est maintenant ouverte.`, 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Impossible de rouvrir la période.', 'Fermer', { duration: 4000 });
        this.actionLoading = null;
      }
    });
  }

  fermer(periode: PeriodeSaisie): void {
    this.actionLoading = periode.id;
    this.periodeService.fermerPeriode(periode.id).subscribe({
      next: () => {
        periode.statut = 'FERMEE';
        this.actionLoading = null;
        this.snackBar.open(`La période ${periode.libelle ?? periode.dateRas} est maintenant fermée.`, 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Impossible de fermer la période.', 'Fermer', { duration: 4000 });
        this.actionLoading = null;
      }
    });
  }

  supprimer(periode: PeriodeSaisie): void {
    if (!confirm(`Supprimer la période du ${this.formatDate(periode.dateRas)} ? Cette action est irréversible.`)) return;
    this.actionLoading = periode.id;
    this.periodeService.deletePeriode(periode.id).subscribe({
      next: () => {
        this.dataSource.data = this.dataSource.data.filter(p => p.id !== periode.id);
        this.actionLoading = null;
        this.snackBar.open('Période supprimée.', 'OK', { duration: 3000 });
      },
      error: (err: any) => {
        this.snackBar.open(err.error?.message || 'Suppression impossible.', 'Fermer', { duration: 5000 });
        this.actionLoading = null;
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
