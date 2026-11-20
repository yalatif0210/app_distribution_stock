import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { SeuilsStatutService } from '../../../core/services/seuils-statut.service';
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
import { Pagination, PaginationComponent } from '../../../shared/pagination';

@Component({
  selector: 'app-etats',
  standalone: true,
  imports: [PaginationComponent, CommonModule, DatePipe, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
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

        <!-- Admin / superviseur : d'abord la région, puis les dates RAS de cette région -->
        <mat-form-field *ngIf="multiRegions" appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Région</mat-label>
          <mat-select [(ngModel)]="selectedRegionId" (selectionChange)="majDatesRas()">
            <mat-option [value]="null">{{ auth.isAdmin() ? 'Toutes les régions' : 'Toutes mes régions' }}</mat-option>
            <mat-option *ngFor="let r of regions" [value]="r.id">{{ r.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field *ngIf="multiRegions" appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Date RAS *</mat-label>
          <mat-select [(ngModel)]="selectedDateRas" [disabled]="!datesRas.length">
            <mat-option *ngFor="let d of datesRas" [value]="d.dateRas">{{ d.label }}</mat-option>
          </mat-select>
          <mat-hint *ngIf="!datesRas.length">Aucune date RAS pour cette région</mat-hint>
          <mat-hint *ngIf="datesRas.length && selectedRegionId">{{ datesRas.length }} date(s) RAS dans cette région</mat-hint>
        </mat-form-field>

        <mat-form-field *ngIf="!multiRegions" appearance="fill" style="flex:1;min-width:200px;">
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
            <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} - {{ p.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" [disabled]="!(multiRegions ? selectedDateRas : selectedPeriodeId) || loading" (click)="rechercher()" style="height:56px;padding:0 1.5rem;">
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

          <ng-container matColumnDef="region">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="regionNom">Région</th>
            <td mat-cell *matCellDef="let e" style="font-size:.85rem;">{{ e.regionNom }}</td>
          </ng-container>

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
              {{ e.dateSoumission ? (e.dateSoumission | date:'dd/MM/yyyy HH:mm') : '-' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let e" style="text-align:right;white-space:nowrap;">
              <button *ngIf="auth.isPharmacienRegion() && e.statut === 'SUBMITTED'" mat-icon-button color="primary"
                (click)="rouvrirEtat(e, $event)"
                matTooltip="Rouvrir cet état : le site pourra le corriger puis le soumettre à nouveau">
                <mat-icon style="font-size:18px;width:18px;height:18px;">lock_open</mat-icon>
              </button>
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


        <div *ngIf="!loadingDetail && detailData && detailData.lignes.length === 0"
          style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:.875rem;">
          Aucun produit configuré pour cette structure sur ce programme.
        </div>

        <table *ngIf="detailData && detailData.lignes.length > 0"
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
            <tr *ngFor="let ligne of pgDetail.page(detailData.lignes)"
              style="border-bottom:1px solid var(--border-color);"
              [style.opacity]="ligne.saved ? '1' : '0.5'">
              <td style="padding:.5rem 1rem;">
                <code style="font-size:.75rem;color:var(--accent-color);">{{ ligne.produitCode }}</code>
              </td>
              <td style="padding:.5rem 1rem;font-size:.875rem;font-weight:500;">{{ ligne.produitNom }}</td>
              <td style="padding:.5rem .75rem;text-align:center;font-size:.78rem;color:var(--text-secondary);">{{ ligne.produitUnite }}</td>
              <td style="padding:.5rem .75rem;text-align:right;font-family:monospace;font-size:.875rem;">
                {{ ligne.saved ? (ligne.stockDisponible ?? '-') : '-' }}
              </td>
              <td style="padding:.5rem .75rem;text-align:right;font-family:monospace;font-size:.875rem;">
                {{ ligne.saved ? (ligne.cmm ?? '-') : '-' }}
              </td>
              <td style="padding:.5rem .75rem;text-align:center;">
                <span *ngIf="ligne.saved && ligne.msd !== null"
                  [style.color]="msdColor(ligne.msd!)"
                  style="font-family:monospace;font-weight:700;font-size:.875rem;">
                  {{ ligne.msd | number:'1.1-1' }}
                </span>
                <span *ngIf="!ligne.saved || ligne.msd === null" style="color:var(--text-secondary);font-size:.8rem;">-</span>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;">
                <span *ngIf="ligne.saved && ligne.statutStock"
                  [class]="'badge badge-' + (ligne.statutStock || '').toLowerCase().replace('_', '-')" style="font-size:.65rem;">
                  {{ statutLabel(ligne.statutStock) }}
                </span>
                <span *ngIf="!ligne.saved" style="font-size:.72rem;color:var(--text-secondary);font-style:italic;">Non saisi</span>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;font-size:.8rem;">
                {{ ligne.expireDate ? (ligne.expireDate | date:'dd/MM/yyyy') : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
        <app-pagination *ngIf="detailData" [p]="pgDetail" [total]="detailData.lignes.length"></app-pagination>
      </mat-card-content>
    </mat-card>

    <div *ngIf="!loading && dsEtats.data.length === 0 && searched" style="text-align:center;padding:3rem;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;">
      <mat-icon style="font-size:3rem;width:3rem;height:3rem;display:block;margin:0 auto 1rem;">inbox</mat-icon>
      Aucun état de stock pour cette sélection
    </div>
  `
})
export class EtatsComponent implements OnInit {
  seuilsStatut = inject(SeuilsStatutService);
  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  regions: Region[] = [];
  dsEtats = new MatTableDataSource<EtatStockSummary>([]);

  selectedPeriodeId: number | null = null;
  selectedProgrammeId: number | null = null;
  selectedRegionId: number | null = null;

  loading = false;
  searched = false;
  private readonly colonnesBase = ['structure', 'programme', 'statut', 'lignes', 'dateCreation', 'dateSoumission', 'actions'];
  /** La colonne Région n'a de sens que pour qui voit plusieurs régions. */
  get colonnes(): string[] {
    return this.multiRegions ? ['region', ...this.colonnesBase] : this.colonnesBase;
  }

  selectedEtat: EtatStockSummary | null = null;
  detailData: EtatStock | null = null;
  loadingDetail = false;
  // Pagination des tableaux
  pgDetail = new Pagination();


  // Le tableau n'existe qu'une fois des résultats chargés : pagination et tri sont branchés à son apparition
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) { if (p) this.dsEtats.paginator = p; }
  @ViewChild(MatSort) set sort(s: MatSort | undefined) { if (s) this.dsEtats.sort = s; }

  private snackBar = inject(MatSnackBar);

  constructor(
    public auth: AuthService,
    private stockService: StockService,
    private periodeService: PeriodeService,
    private refService: ReferentielService
  ) {}

  /** Admin et superviseur voient plusieurs régions : on choisit la région, puis la date RAS. */
  get multiRegions(): boolean {
    return this.auth.isAdmin() || this.auth.isSuperviseur();
  }

  /** Dates RAS proposées (admin / superviseur). */
  datesRas: { dateRas: string; label: string }[] = [];
  selectedDateRas: string | null = null;

  ngOnInit(): void {
    const p$ = this.multiRegions
      ? this.periodeService.getAllPeriodes()
      : this.periodeService.findByRegion();
    p$.subscribe(p => { this.periodes = p; if (this.multiRegions) this.majDatesRas(); });
    this.refService.getProgrammesGeres().subscribe(p => this.programmes = p.filter((x: Programme) => x.active));

    if (this.multiRegions) {
      const supervisedIds = new Set(this.auth.supervisedRegionIds);
      this.refService.getRegions().subscribe(r => {
        this.regions = this.auth.isAdmin() ? r : r.filter(x => supervisedIds.has(x.id));
        // Une seule région : on la choisit d'office
        if (this.regions.length === 1) { this.selectedRegionId = this.regions[0].id; this.majDatesRas(); }
      });
    }
  }

  /**
   * Dates RAS de la région choisie (avec leur statut), ou dates distinctes de toutes les
   * régions. La date déjà choisie est gardée si elle existe encore.
   */
  majDatesRas(): void {
    const statut = (s: string) => s === 'OUVERTE' ? 'ouverte' : (s === 'FERMEE' ? 'fermée' : s.toLowerCase());
    const fmt = (p: PeriodeSaisie) => p.libelle ?? p.dateRas.split('-').reverse().join('/');
    if (this.selectedRegionId) {
      this.datesRas = this.periodes.filter(p => p.regionId === this.selectedRegionId)
        .map(p => ({ dateRas: p.dateRas, label: `${fmt(p)} · ${statut(p.statut)}` }));
    } else {
      const vues = new Set<string>();
      this.datesRas = [];
      for (const p of this.periodes) {
        if (vues.has(p.dateRas)) continue;
        vues.add(p.dateRas);
        const n = this.periodes.filter(x => x.dateRas === p.dateRas).length;
        this.datesRas.push({ dateRas: p.dateRas, label: `${fmt(p)} · ${n} région(s)` });
      }
    }
    if (!this.datesRas.some(d => d.dateRas === this.selectedDateRas)) {
      this.selectedDateRas = this.datesRas[0]?.dateRas ?? null;
    }
  }

  applyFilter(value: string): void {
    this.dsEtats.filter = value.trim().toLowerCase();
    this.dsEtats.paginator?.firstPage();
  }

  rechercher(): void {
    if (this.multiRegions) { this.rechercherParDateRas(); return; }
    if (!this.selectedPeriodeId) return;
    this.loading = true;
    this.searched = true;
    this.closeDetail();

    this.stockService.listEtats(this.selectedPeriodeId!, this.selectedProgrammeId, this.selectedRegionId).subscribe({
      next: data => { this.dsEtats.data = data; this.loading = false; },
      error: () => { this.snackBar.open('Erreur lors du chargement.', 'Fermer', { duration: 3000 }); this.loading = false; }
    });
  }

  /** Admin / superviseur : la période de chaque région ciblée qui porte la date RAS choisie. */
  private rechercherParDateRas(): void {
    if (!this.selectedDateRas) return;
    const regionIds = this.selectedRegionId ? [this.selectedRegionId] : this.regions.map(r => r.id);
    const cibles = regionIds
      .map(rid => this.periodes.find(p => p.regionId === rid && p.dateRas === this.selectedDateRas))
      .filter((p): p is PeriodeSaisie => !!p);
    this.searched = true;
    this.closeDetail();
    if (!cibles.length) { this.dsEtats.data = []; return; }
    this.loading = true;
    forkJoin(cibles.map(p =>
      this.stockService.listEtats(p.id, this.selectedProgrammeId, p.regionId ?? null).pipe(catchError(() => of([])))
    )).subscribe(results => {
      // Le résumé d'un état ne porte pas sa région : on la reprend de la période interrogée
      this.dsEtats.data = (results as EtatStockSummary[][]).flatMap((etats, i) =>
        etats.map(e => ({ ...e, regionNom: cibles[i].regionNom ?? this.regions.find(r => r.id === cibles[i].regionId)?.nom ?? '' })));
      this.loading = false;
    });
  }

  toggleDetail(etat: EtatStockSummary): void {
    if (this.selectedEtat?.id === etat.id) { this.closeDetail(); return; }
    this.selectedEtat = etat;
    this.pgDetail.premiere();
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

  /** Un état soumis par erreur redevient modifiable par le site. */
  rouvrirEtat(etat: EtatStockSummary, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Rouvrir l'état de ${etat.structureNom} ? Le site pourra le corriger puis le soumettre à nouveau.`)) return;
    this.stockService.reopenEtat(etat.id).subscribe({
      next: () => {
        this.rechercher();
        this.snackBar.open('État rouvert : le site peut le corriger.', 'OK', { duration: 3000 });
      },
      error: (err: any) => this.snackBar.open(err.error?.message || 'Erreur.', 'Fermer', { duration: 3000 })
    });
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
    return this.seuilsStatut.couleurMsd(msd);
  }
}
