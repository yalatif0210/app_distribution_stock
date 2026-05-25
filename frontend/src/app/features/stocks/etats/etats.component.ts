import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StockService } from '../../../core/services/stock.service';
import { PeriodeService } from '../../../core/services/periode.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EtatStock, EtatStockSummary, PeriodeSaisie, Programme, Region } from '../../../core/models/models';

@Component({
  selector: 'app-etats',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule, MatDividerModule],
  template: `
    <div class="page-header">
      <h1>Consultation des états de stock</h1>
      <p>Visualisez et gérez les états de saisie des structures</p>
    </div>

    <!-- Filtres de recherche -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">

        <mat-form-field appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Période *</mat-label>
          <mat-select [(ngModel)]="selectedPeriodeId">
            <mat-option [value]="null">-- Choisir --</mat-option>
            <mat-option *ngFor="let p of periodes" [value]="p.id">{{ p.libelle ?? (p.dateRas | date:'dd/MM/yyyy') }} ({{ p.statut }})</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId">
            <mat-option [value]="null">Tous</mat-option>
            <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field *ngIf="auth.isAdmin() || auth.isSuperviseur()" appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Région</mat-label>
          <mat-select [(ngModel)]="selectedRegionId">
            <mat-option [value]="null">{{ auth.isAdmin() ? 'Toutes les régions' : 'Toutes mes régions' }}</mat-option>
            <mat-option *ngFor="let r of regions" [value]="r.id">{{ r.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" [disabled]="!selectedPeriodeId || loading" (click)="rechercher()" style="height:56px;padding:0 1.5rem;">
          <mat-spinner *ngIf="loading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!loading">search</mat-icon> Rechercher
        </button>
      </mat-card-content>
    </mat-card>

    <!-- Résultats -->
    <mat-card *ngIf="dsEtats.data.length > 0">
      <mat-card-content style="padding:0 0 .5rem 0;">

        <div style="padding:.75rem 1rem .25rem;">
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Filtrer les résultats</mat-label>
            <input matInput #filterInput (input)="applyFilter(filterInput.value)">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>

        <table mat-table [dataSource]="dsEtats" matSort style="width:100%;">

          <ng-container matColumnDef="structure">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Structure</th>
            <td mat-cell *matCellDef="let e">
              <div style="font-size:.875rem;font-weight:500;">{{ e.structureNom }}</div>
              <div style="font-size:.75rem;color:var(--text-secondary);">
                <code style="color:var(--accent-color);">{{ e.structureCode }}</code> · {{ e.structureType }}
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="programme">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Programme</th>
            <td mat-cell *matCellDef="let e" style="font-size:.875rem;">{{ e.programmeNom }}</td>
          </ng-container>

          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
            <td mat-cell *matCellDef="let e">
              <span [style.background]="e.statut === 'SUBMITTED' ? '#dcfce7' : '#fef9c3'"
                    [style.color]="e.statut === 'SUBMITTED' ? '#15803d' : '#92400e'"
                    style="padding:.2rem .6rem;border-radius:999px;font-size:.7rem;font-weight:700;">
                {{ e.statut === 'SUBMITTED' ? 'SOUMIS' : 'BROUILLON' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="lignes">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Lignes renseignées</th>
            <td mat-cell *matCellDef="let e" style="text-align:right;font-family:monospace;font-size:.875rem;">
              {{ e.nbLignesSaved }} / {{ e.nbLignes }}
            </td>
          </ng-container>

          <ng-container matColumnDef="dateCreation">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Créé le</th>
            <td mat-cell *matCellDef="let e" style="font-size:.8rem;color:var(--text-secondary);">{{ e.dateCreation | date:'dd/MM/yyyy HH:mm' }}</td>
          </ng-container>

          <ng-container matColumnDef="dateSoumission">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Soumis le</th>
            <td mat-cell *matCellDef="let e" style="font-size:.8rem;color:var(--text-secondary);">
              {{ e.dateSoumission ? (e.dateSoumission | date:'dd/MM/yyyy HH:mm') : '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let e" style="text-align:right;">
              <button *ngIf="auth.isPharmacienRegion()" mat-icon-button color="warn"
                (click)="supprimerEtat(e, $event)"
                matTooltip="Supprimer cet état">
                <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="colonnes"></tr>
          <tr mat-row *matRowDef="let row; columns: colonnes;"
            style="cursor:pointer;transition:background .15s;"
            [style.background]="selectedEtat?.id === row.id ? 'rgba(99,102,241,.07)' : ''"
            (click)="toggleDetail(row)">
          </tr>
          <tr class="mat-row" *matNoDataRow>
            <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-secondary);">Aucun résultat pour ce filtre</td>
          </tr>
        </table>
        <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>

    <!-- Panneau de détail -->
    <mat-card *ngIf="selectedEtat" style="margin-top:1.25rem;">
      <mat-card-header style="padding:.875rem 1rem .25rem;">
        <mat-card-title style="font-size:.95rem;display:flex;align-items:center;gap:.75rem;width:100%;">
          <mat-icon style="color:var(--accent-color);">visibility</mat-icon>
          <span>{{ selectedEtat.structureNom }}</span>
          <span style="font-size:.8rem;font-weight:400;color:var(--text-secondary);">· {{ selectedEtat.programmeNom }} · {{ selectedEtat.periodeLibelle }}</span>
          <span [style.background]="selectedEtat.statut === 'SUBMITTED' ? '#dcfce7' : '#fef9c3'"
                [style.color]="selectedEtat.statut === 'SUBMITTED' ? '#15803d' : '#92400e'"
                style="padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700;">
            {{ selectedEtat.statut === 'SUBMITTED' ? 'SOUMIS' : 'BROUILLON' }}
          </span>
          <span style="flex:1;"></span>
          <button mat-icon-button (click)="closeDetail()" matTooltip="Fermer">
            <mat-icon>close</mat-icon>
          </button>
        </mat-card-title>
      </mat-card-header>

      <mat-card-content style="padding:0;">

        <div *ngIf="loadingDetail" style="text-align:center;padding:2rem;">
          <mat-spinner diameter="32"></mat-spinner>
        </div>

        <div *ngIf="!loadingDetail && detailData && detailData.lignes.length === 0"
          style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:.875rem;">
          Aucun produit configuré pour cette structure sur ce programme.
        </div>

        <table *ngIf="!loadingDetail && detailData && detailData.lignes.length > 0"
          style="width:100%;border-collapse:collapse;min-width:700px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid var(--border-color);">
              <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Code</th>
              <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Produit</th>
              <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Unité</th>
              <th style="padding:.6rem .75rem;text-align:right;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Stock dispo</th>
              <th style="padding:.6rem .75rem;text-align:right;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">CMM</th>
              <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">MSD</th>
              <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Statut</th>
              <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Date péremption</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let ligne of detailData.lignes"
              style="border-bottom:1px solid var(--border-color);"
              [style.opacity]="ligne.saved ? '1' : '0.5'">
              <td style="padding:.5rem 1rem;">
                <code style="font-size:.75rem;color:var(--accent-color);">{{ ligne.produitCode }}</code>
              </td>
              <td style="padding:.5rem 1rem;font-size:.875rem;font-weight:500;">{{ ligne.produitNom }}</td>
              <td style="padding:.5rem .75rem;text-align:center;font-size:.78rem;color:var(--text-secondary);">{{ ligne.produitUnite }}</td>
              <td style="padding:.5rem .75rem;text-align:right;font-family:monospace;font-size:.875rem;">
                {{ ligne.saved ? (ligne.stockDisponible ?? '—') : '—' }}
              </td>
              <td style="padding:.5rem .75rem;text-align:right;font-family:monospace;font-size:.875rem;">
                {{ ligne.saved ? (ligne.cmm ?? '—') : '—' }}
              </td>
              <td style="padding:.5rem .75rem;text-align:center;">
                <span *ngIf="ligne.saved && ligne.msd !== null"
                  [style.color]="msdColor(ligne.msd!)"
                  style="font-family:monospace;font-weight:700;font-size:.875rem;">
                  {{ ligne.msd | number:'1.1-1' }}
                </span>
                <span *ngIf="!ligne.saved || ligne.msd === null" style="color:var(--text-secondary);font-size:.8rem;">—</span>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;">
                <span *ngIf="ligne.saved && ligne.statutStock"
                  [class]="'badge badge-' + (ligne.statutStock || '').toLowerCase().replace('_', '-')" style="font-size:.65rem;">
                  {{ statutLabel(ligne.statutStock) }}
                </span>
                <span *ngIf="!ligne.saved" style="font-size:.72rem;color:var(--text-secondary);font-style:italic;">Non saisi</span>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;font-size:.8rem;">
                {{ ligne.expireDate ? (ligne.expireDate | date:'dd/MM/yyyy') : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </mat-card-content>
    </mat-card>

    <div *ngIf="!loading && dsEtats.data.length === 0 && searched" style="text-align:center;padding:3rem;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;">
      <mat-icon style="font-size:3rem;width:3rem;height:3rem;display:block;margin:0 auto 1rem;">inbox</mat-icon>
      Aucun état de stock pour cette sélection
    </div>
  `
})
export class EtatsComponent implements OnInit, AfterViewInit {
  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  regions: Region[] = [];
  dsEtats = new MatTableDataSource<EtatStockSummary>([]);

  selectedPeriodeId: number | null = null;
  selectedProgrammeId: number | null = null;
  selectedRegionId: number | null = null;

  loading = false;
  searched = false;
  colonnes = ['structure', 'programme', 'statut', 'lignes', 'dateCreation', 'dateSoumission', 'actions'];

  selectedEtat: EtatStockSummary | null = null;
  detailData: EtatStock | null = null;
  loadingDetail = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private snackBar = inject(MatSnackBar);

  constructor(
    public auth: AuthService,
    private stockService: StockService,
    private periodeService: PeriodeService,
    private refService: ReferentielService
  ) {}

  ngOnInit(): void {
    const p$ = (this.auth.isAdmin() || this.auth.isSuperviseur())
      ? this.periodeService.getAllPeriodes()
      : this.periodeService.findByRegion();
    p$.subscribe(p => this.periodes = p);
    this.refService.getProgrammes().subscribe(p => this.programmes = p.filter((x: Programme) => x.active));

    if (this.auth.isAdmin()) {
      this.refService.getRegions().subscribe(r => this.regions = r);
    } else if (this.auth.isSuperviseur()) {
      const supervisedIds = new Set(this.auth.supervisedRegionIds);
      this.refService.getRegions().subscribe(r => this.regions = r.filter(x => supervisedIds.has(x.id)));
    }
  }

  ngAfterViewInit(): void {
    this.dsEtats.paginator = this.paginator;
    this.dsEtats.sort = this.sort;
  }

  applyFilter(value: string): void {
    this.dsEtats.filter = value.trim().toLowerCase();
    this.dsEtats.paginator?.firstPage();
  }

  rechercher(): void {
    if (!this.selectedPeriodeId) return;
    this.loading = true;
    this.searched = true;
    this.closeDetail();

    if (this.auth.isSuperviseur() && this.selectedRegionId === null) {
      const ids = this.auth.supervisedRegionIds;
      if (ids.length === 0) { this.dsEtats.data = []; this.loading = false; return; }
      forkJoin(ids.map(rid =>
        this.stockService.listEtats(this.selectedPeriodeId!, this.selectedProgrammeId, rid)
          .pipe(catchError(() => of([])))
      )).subscribe(results => {
        this.dsEtats.data = (results as EtatStockSummary[][]).flat();
        this.loading = false;
      });
      return;
    }

    this.stockService.listEtats(this.selectedPeriodeId!, this.selectedProgrammeId, this.selectedRegionId).subscribe({
      next: data => { this.dsEtats.data = data; this.loading = false; },
      error: () => { this.snackBar.open('Erreur lors du chargement.', 'Fermer', { duration: 3000 }); this.loading = false; }
    });
  }

  toggleDetail(etat: EtatStockSummary): void {
    if (this.selectedEtat?.id === etat.id) { this.closeDetail(); return; }
    this.selectedEtat = etat;
    this.detailData = null;
    this.loadingDetail = true;
    this.stockService.getEtat(etat.periodeId, etat.programmeId, etat.structureId).subscribe({
      next: data => { this.detailData = data; this.loadingDetail = false; },
      error: () => {
        this.loadingDetail = false;
        this.snackBar.open('Erreur lors du chargement du détail.', 'Fermer', { duration: 3000 });
      }
    });
  }

  closeDetail(): void {
    this.selectedEtat = null;
    this.detailData = null;
  }

  supprimerEtat(etat: EtatStockSummary, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Supprimer l'état de ${etat.structureNom} ? La structure pourra en recréer un.`)) return;
    this.stockService.deleteEtat(etat.id).subscribe({
      next: () => {
        this.dsEtats.data = this.dsEtats.data.filter(e => e.id !== etat.id);
        if (this.selectedEtat?.id === etat.id) this.closeDetail();
        this.snackBar.open('État supprimé.', 'OK', { duration: 2500 });
      },
      error: (err: any) => this.snackBar.open(err.error?.message || 'Erreur.', 'Fermer', { duration: 3000 })
    });
  }

  statutLabel(statut: string | null): string {
    const labels: Record<string, string> = {
      BIEN_STOCKE:   'BIEN STOCKÉ',
      STOCK_DORMANT: 'STOCK DORMANT',
    };
    return labels[statut ?? ''] ?? (statut ?? '');
  }

  msdColor(msd: number): string {
    if (msd === 0) return '#dc2626';
    if (msd < 1) return '#ea580c';
    if (msd < 2) return '#d97706';
    if (msd <= 4) return '#16a34a';
    return '#7c3aed';
  }
}
