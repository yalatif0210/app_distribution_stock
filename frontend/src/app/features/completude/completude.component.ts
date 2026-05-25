import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompletudeService } from '../../core/services/completude.service';
import { PeriodeService } from '../../core/services/periode.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { AuthService } from '../../core/auth/auth.service';
import { CompletudeDTO, PeriodeSaisie, Region } from '../../core/models/models';

@Component({
  selector: 'app-completude',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatCheckboxModule, MatSnackBarModule,
    MatTooltipModule, MatExpansionModule
  ],
  template: `
    <div class="page-header">
      <h1>Complétude des saisies</h1>
      <p>Suivez le taux de transmission des stocks par période et programme</p>
    </div>

    <!-- Filters -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; padding-top:.5rem;">

        <!-- Période groupée par date (admin / superviseur) -->
        <mat-form-field *ngIf="auth.isAdmin() || auth.isSuperviseur()" appearance="fill" style="flex:1; min-width:200px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedDateRas" (selectionChange)="onFilterChange()">
            <mat-option *ngFor="let p of periodDateOptions" [value]="p.dateRas">{{ p.label }}</mat-option>
          </mat-select>
          <mat-hint *ngIf="selectedDateRas">
            {{ regionsForDate(selectedDateRas).length }} région(s) avec cette date
          </mat-hint>
        </mat-form-field>

        <!-- Période par identifiant (pharmacien) -->
        <mat-form-field *ngIf="!auth.isAdmin() && !auth.isSuperviseur()" appearance="fill" style="flex:1; min-width:200px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedPeriodId" (selectionChange)="onFilterChange()">
            <mat-option *ngFor="let p of allPeriodes" [value]="p.id">
              {{ p.libelle ?? p.dateRas }} — {{ p.statut }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1; min-width:200px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId" (selectionChange)="onFilterChange()">
            <mat-option *ngFor="let p of programmeOptions" [value]="p.value">{{ p.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field *ngIf="auth.isAdmin() || auth.isSuperviseur()" appearance="fill" style="flex:1; min-width:200px;">
          <mat-label>Région(s)</mat-label>
          <mat-select [(ngModel)]="selectedRegionIds" multiple (selectionChange)="onFilterChange()">
            <mat-option *ngFor="let r of regions" [value]="r.id">{{ r.nom }}</mat-option>
          </mat-select>
          <mat-hint>
            {{ selectedRegionIds.length === 0
               ? (auth.isAdmin() ? 'Toutes les régions' : 'Toutes mes régions')
               : selectedRegionIds.length + ' région(s)' }}
          </mat-hint>
        </mat-form-field>

        <button mat-stroked-button color="primary" (click)="load()"
          [disabled]="!canLoad"
          style="height:56px; padding:0 1.5rem;">
          <mat-icon>refresh</mat-icon> Actualiser
        </button>
      </mat-card-content>
    </mat-card>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement…</span>
    </div>

    <ng-container *ngIf="!loading && completudes.length > 0">

      <!-- Global KPI -->
      <mat-card *ngIf="globalStat as g" style="margin-bottom:1.25rem;">
        <mat-card-content style="padding-top:1rem;">
          <div style="display:flex; flex-wrap:wrap; gap:1.5rem; align-items:center;">
            <div style="display:flex; flex-direction:column; align-items:center; min-width:140px;">
              <div style="font-size:3rem; font-weight:800; line-height:1;" [style.color]="kpiColor(g.taux)">
                {{ g.taux | number:'1.0-0' }}%
              </div>
              <div style="color:var(--text-secondary); font-size:.8rem; margin-top:.4rem;">Taux global</div>
              <mat-progress-bar mode="determinate" [value]="g.taux" style="width:120px; margin-top:.75rem;"
                [color]="g.taux >= 80 ? 'primary' : 'warn'">
              </mat-progress-bar>
            </div>
            <div style="display:flex; gap:1rem; flex-wrap:wrap; flex:1;">
              <div class="stat-card" style="flex:1; min-width:120px;">
                <div class="stat-label" style="text-transform:uppercase; font-size:.7rem; font-weight:600;">Programme</div>
                <div style="font-size:.95rem; font-weight:700; color:var(--accent-color); margin-top:.4rem;">{{ g.programmeNom }}</div>
              </div>
              <div class="stat-card" style="flex:1; min-width:120px;">
                <div class="stat-label" style="text-transform:uppercase; font-size:.7rem; font-weight:600;">Attendues</div>
                <div class="stat-value" style="margin-top:.4rem;">{{ g.totalAttendu }}</div>
              </div>
              <div class="stat-card" style="flex:1; min-width:120px;">
                <div class="stat-label" style="text-transform:uppercase; font-size:.7rem; font-weight:600;">Transmises</div>
                <div class="stat-value" style="margin-top:.4rem;" [style.color]="kpiColor(g.taux)">{{ g.totalSaisi }}</div>
              </div>
              <div *ngIf="auth.isAdmin() || auth.isSuperviseur()" class="stat-card" style="flex:1; min-width:120px;">
                <div class="stat-label" style="text-transform:uppercase; font-size:.7rem; font-weight:600;">Régions évaluées</div>
                <div class="stat-value" style="margin-top:.4rem;">{{ completudes.length }}</div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Accordion par région -->
      <mat-accordion [multi]="false">
        <mat-expansion-panel *ngFor="let c of completudes"
          [expanded]="expandedRegionId === c.regionId"
          (opened)="onPanelOpened(c)"
          (closed)="onPanelClosed(c)">

          <mat-expansion-panel-header>
            <mat-panel-title style="display:flex; align-items:center; gap:.75rem; min-width:0; flex:0 0 auto; max-width:40%;">
              <mat-icon style="color:var(--accent-color); flex-shrink:0; font-size:18px; width:18px; height:18px;">location_on</mat-icon>
              <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                {{ auth.isAdmin() || auth.isSuperviseur() ? regionNom(c.regionId) : (c.periodeLibelle) }}
              </span>
            </mat-panel-title>
            <mat-panel-description style="display:flex; align-items:center; gap:.75rem; flex-wrap:nowrap;">
              <span style="font-size:.82rem; white-space:nowrap; color:var(--text-secondary);">
                {{ c.totalSaisi }}/{{ c.totalAttendu }}
              </span>
              <mat-progress-bar mode="determinate" [value]="c.tauxCompletude" style="width:70px; flex-shrink:0;"
                [color]="c.tauxCompletude >= 80 ? 'primary' : 'warn'">
              </mat-progress-bar>
              <strong [style.color]="kpiColor(c.tauxCompletude)" style="font-size:.875rem; white-space:nowrap;">
                {{ c.tauxCompletude | number:'1.0-0' }}%
              </strong>
              <span *ngIf="c.structuresManquantes.length > 0"
                style="background:rgba(239,68,68,.15); color:#ef4444; font-size:.68rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; white-space:nowrap;">
                {{ c.structuresManquantes.length }} manquante(s)
              </span>
              <span *ngIf="c.structuresManquantes.length === 0"
                style="color:#22c55e; font-size:.75rem; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:.25rem;">
                <mat-icon style="font-size:14px;width:14px;height:14px;">check_circle</mat-icon> Complet
              </span>
            </mat-panel-description>
          </mat-expansion-panel-header>

          <!-- Corps du panneau -->
          <div *ngIf="c.structuresManquantes.length === 0"
            style="padding:1.5rem 0; text-align:center; color:#22c55e;">
            <mat-icon style="font-size:2rem;width:2rem;height:2rem;display:block;margin:0 auto .5rem;">check_circle</mat-icon>
            Toutes les structures ont transmis leurs données.
          </div>

          <ng-container *ngIf="c.structuresManquantes.length > 0">

            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.5rem 0 .75rem; flex-wrap:wrap;">
              <mat-form-field appearance="outline" style="flex:1; min-width:200px;">
                <mat-label>Filtrer les structures</mat-label>
                <input matInput #fManquantes (input)="dsManquantes.filter=fManquantes.value.trim().toLowerCase(); dsManquantes.paginator?.firstPage()" placeholder="Code, nom…">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              <button *ngIf="auth.role === 'PHARMACIEN_REGION'" mat-raised-button color="accent"
                (click)="relancer()"
                [disabled]="selectedStructureIds.length === 0 || relanceLoading">
                <mat-spinner *ngIf="relanceLoading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
                <mat-icon *ngIf="!relanceLoading">send</mat-icon>
                Relancer ({{ selectedStructureIds.length }})
              </button>
            </div>

            <table mat-table [dataSource]="dsManquantes" matSort #sortManquantes="matSort" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:50px;">
                  <mat-checkbox *ngIf="auth.role === 'PHARMACIEN_REGION'"
                    [(ngModel)]="selectAll" (change)="toggleSelectAll(c)">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let s">
                  <mat-checkbox *ngIf="auth.role === 'PHARMACIEN_REGION'"
                    [checked]="selectedStructureIds.includes(s.id)"
                    (change)="onCheckboxChange(s.id, $event.checked, c)">
                  </mat-checkbox>
                </td>
              </ng-container>

              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th>
                <td mat-cell *matCellDef="let s">
                  <code style="color:var(--accent-color);font-size:.8rem;">{{ s.code }}</code>
                </td>
              </ng-container>

              <ng-container matColumnDef="nom">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Nom de la structure</th>
                <td mat-cell *matCellDef="let s">{{ s.nom }}</td>
              </ng-container>

              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:130px;">Type</th>
                <td mat-cell *matCellDef="let s">
                  <span style="background:rgba(129,140,248,.12);color:var(--accent-color);font-size:.7rem;padding:.15rem .5rem;border-radius:.25rem;font-weight:600;">
                    {{ s.type }}
                  </span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="colonnesManquantes"></tr>
              <tr mat-row *matRowDef="let row; columns: colonnesManquantes;"></tr>
              <tr class="mat-row" *matNoDataRow>
                <td [attr.colspan]="colonnesManquantes.length" style="text-align:center;padding:1.5rem;color:var(--text-secondary);">Aucun résultat</td>
              </tr>
            </table>
            <mat-paginator #pagManquantes [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
          </ng-container>

        </mat-expansion-panel>
      </mat-accordion>
    </ng-container>

    <!-- Aucun résultat -->
    <div *ngIf="!loading && completudes.length === 0 && hasSearched"
      style="text-align:center;padding:3rem;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;">
      <mat-icon style="font-size:3rem;width:3rem;height:3rem;display:block;margin:0 auto 1rem;">inbox</mat-icon>
      Aucune région n'a ouvert de période pour cette date.
    </div>
  `
})
export class CompletudeComponent implements OnInit {
  @ViewChild('pagManquantes') pagManquantes?: MatPaginator;
  @ViewChild('sortManquantes') sortManquantes?: MatSort;

  dsManquantes = new MatTableDataSource<CompletudeDTO['structuresManquantes'][0]>([]);

  completudes: CompletudeDTO[] = [];
  loading = false;
  hasSearched = false;
  relanceLoading = false;

  // Données brutes des périodes (pour le lookup regionId→periodeId)
  allPeriodes: PeriodeSaisie[] = [];

  // Options filtrées pour les selects
  periodDateOptions: { dateRas: string; label: string }[] = [];  // admin/superviseur : dates distinctes
  programmeOptions: { label: string; value: number }[] = [];
  regions: Region[] = [];

  // Modèles de sélection
  selectedDateRas: string | null = null;   // admin/superviseur
  selectedPeriodId: number | null = null;  // pharmacien
  selectedProgrammeId: number | null = null;
  selectedRegionIds: number[] = [];

  expandedRegionId: number | null = null;
  selectedStructureIds: number[] = [];
  selectAll = false;
  searchManquantes: Record<number, string> = {};

  colonnesManquantes = ['select', 'code', 'nom', 'type'];

  private snackBar = inject(MatSnackBar);

  constructor(
    private completudeService: CompletudeService,
    private periodeService: PeriodeService,
    private referentielService: ReferentielService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadFilters();
  }

  loadFilters(): void {
    if (this.auth.isAdmin() || this.auth.isSuperviseur()) {
      // Toutes les périodes de toutes les régions
      this.periodeService.getAllPeriodes().subscribe(periodes => {
        this.allPeriodes = periodes;
        // Dates distinctes, ordre anti-chronologique conservé par l'API
        const seen = new Set<string>();
        this.periodDateOptions = [];
        for (const p of periodes) {
          if (!seen.has(p.dateRas)) {
            seen.add(p.dateRas);
            this.periodDateOptions.push({
              dateRas: p.dateRas,
              label: p.libelle ?? p.dateRas
            });
          }
        }
        if (this.periodDateOptions.length > 0) {
          this.selectedDateRas = this.periodDateOptions[0].dateRas;
        }
      });

      if (this.auth.isAdmin()) {
        this.referentielService.getRegions().subscribe(r => this.regions = r);
      } else {
        const supervisedIds = new Set(this.auth.supervisedRegionIds);
        this.referentielService.getRegions().subscribe(r => this.regions = r.filter(x => supervisedIds.has(x.id)));
      }
    } else {
      // Pharmacien : périodes de sa propre région
      this.periodeService.findByRegion().subscribe(periodes => {
        this.allPeriodes = periodes;
        if (periodes.length > 0) this.selectedPeriodId = periodes[0].id;
      });
    }

    this.referentielService.getProgrammes().subscribe(programmes => {
      this.programmeOptions = programmes
        .filter(p => p.active)
        .map(p => ({ label: p.nom, value: p.id }));
      if (programmes.length > 0) this.selectedProgrammeId = programmes[0].id;
    });
  }

  filteredManquantes(c: CompletudeDTO): CompletudeDTO['structuresManquantes'] {
    const q = (this.searchManquantes[c.regionId] ?? '').trim().toLowerCase();
    if (!q) return c.structuresManquantes;
    return c.structuresManquantes.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.nom.toLowerCase().includes(q) ||
      (s.type ?? '').toLowerCase().includes(q)
    );
  }

  get canLoad(): boolean {
    const hasPeriod = (this.auth.isAdmin() || this.auth.isSuperviseur())
      ? !!this.selectedDateRas
      : !!this.selectedPeriodId;
    return hasPeriod && !!this.selectedProgrammeId && !this.loading;
  }

  onFilterChange(): void {
    if (this.canLoad) this.load();
  }

  load(): void {
    if (!this.selectedProgrammeId) return;
    this.loading = true;
    this.hasSearched = true;
    this.completudes = [];
    this.expandedRegionId = null;
    this.selectedStructureIds = [];
    this.selectAll = false;
    this.searchManquantes = {};

    if (this.auth.isAdmin() || this.auth.isSuperviseur()) {
      this.loadForAdminOrSuperviseur();
    } else {
      this.loadForPharmacien();
    }
  }

  private loadForAdminOrSuperviseur(): void {
    if (!this.selectedDateRas) { this.loading = false; return; }

    const targetRegionIds = this.selectedRegionIds.length > 0
      ? this.selectedRegionIds
      : (this.auth.isAdmin() ? this.regions.map(r => r.id) : this.auth.supervisedRegionIds);

    if (targetRegionIds.length === 0) { this.loading = false; return; }

    // Pour chaque région cible, on cherche son periodeId correspondant à la date sélectionnée.
    // Les régions sans période pour cette date sont ignorées.
    type RegionCall = { regionId: number; call: Observable<CompletudeDTO | null> };
    const calls: RegionCall[] = targetRegionIds
      .map(rid => {
        const periode = this.allPeriodes.find(p => p.regionId === rid && p.dateRas === this.selectedDateRas);
        if (!periode) return null;
        return {
          regionId: rid,
          call: this.completudeService.getCompletude(periode.id, this.selectedProgrammeId!, rid)
            .pipe(catchError(() => of(null)))
        };
      })
      .filter((c): c is RegionCall => c !== null);

    if (calls.length === 0) {
      this.loading = false;
      return;
    }

    forkJoin(calls.map(c => c.call)).subscribe(results => {
      this.completudes = (results.filter(r => r !== null) as CompletudeDTO[])
        .sort((a, b) => this.regionNom(a.regionId).localeCompare(this.regionNom(b.regionId)));
      if (this.completudes.length === 1) {
        this.expandedRegionId = this.completudes[0].regionId;
      }
      this.loading = false;
    });
  }

  private loadForPharmacien(): void {
    if (!this.selectedPeriodId) { this.loading = false; return; }
    const regionId = this.auth.regionId!;
    this.completudeService.getCompletude(this.selectedPeriodId, this.selectedProgrammeId!, regionId)
      .subscribe({
        next: data => {
          this.completudes = [data];
          this.expandedRegionId = data.regionId;
          this.loading = false;
        },
        error: () => {
          this.snackBar.open('Impossible de charger la complétude.', 'Fermer', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  /** Nombre de régions ayant une période pour la date donnée. */
  regionsForDate(dateRas: string): PeriodeSaisie[] {
    return this.allPeriodes.filter(p => p.dateRas === dateRas);
  }

  get globalStat() {
    if (this.completudes.length === 0) return null;
    const totalAttendu = this.completudes.reduce((s, d) => s + d.totalAttendu, 0);
    const totalSaisi = this.completudes.reduce((s, d) => s + d.totalSaisi, 0);
    const taux = totalAttendu > 0 ? Math.round(totalSaisi / totalAttendu * 10000) / 100 : 0;
    return {
      totalAttendu, totalSaisi, taux,
      programmeNom: this.completudes[0].programmeNom,
      periodeLibelle: this.completudes[0].periodeLibelle
    };
  }

  regionNom(regionId: number): string {
    return this.regions.find(r => r.id === regionId)?.nom ?? `Région #${regionId}`;
  }

  onPanelOpened(c: CompletudeDTO): void {
    this.expandedRegionId = c.regionId;
    this.selectedStructureIds = [];
    this.selectAll = false;
    this.dsManquantes.data = c.structuresManquantes;
    this.dsManquantes.filterPredicate = (row, filter) =>
      row.code.toLowerCase().includes(filter) ||
      row.nom.toLowerCase().includes(filter) ||
      (row.type ?? '').toLowerCase().includes(filter);
    this.dsManquantes.filter = '';
    setTimeout(() => {
      this.dsManquantes.paginator = this.pagManquantes ?? null;
      this.dsManquantes.sort = this.sortManquantes ?? null;
    }, 0);
  }

  onPanelClosed(c: CompletudeDTO): void {
    if (this.expandedRegionId === c.regionId) {
      this.expandedRegionId = null;
      this.selectedStructureIds = [];
      this.selectAll = false;
      this.dsManquantes.data = [];
    }
  }

  toggleSelectAll(c: CompletudeDTO): void {
    this.selectedStructureIds = this.selectAll ? c.structuresManquantes.map(s => s.id) : [];
  }

  onCheckboxChange(id: number, checked: boolean, c: CompletudeDTO): void {
    this.selectedStructureIds = checked
      ? [...this.selectedStructureIds.filter(i => i !== id), id]
      : this.selectedStructureIds.filter(i => i !== id);
    this.selectAll = this.selectedStructureIds.length === c.structuresManquantes.length;
  }

  relancer(): void {
    if (!this.selectedPeriodId || !this.selectedProgrammeId || this.selectedStructureIds.length === 0) return;
    this.relanceLoading = true;
    this.completudeService.relancer({
      periodeId: this.selectedPeriodId,
      programmeId: this.selectedProgrammeId,
      structureIds: this.selectedStructureIds
    }).subscribe({
      next: () => {
        this.relanceLoading = false;
        this.snackBar.open(`${this.selectedStructureIds.length} structure(s) relancée(s).`, 'OK', { duration: 4000 });
        this.selectedStructureIds = [];
        this.selectAll = false;
      },
      error: () => {
        this.snackBar.open('La relance a échoué.', 'Fermer', { duration: 4000 });
        this.relanceLoading = false;
      }
    });
  }

  kpiColor(taux: number): string {
    if (taux >= 80) return '#22c55e';
    if (taux >= 50) return '#f97316';
    return '#ef4444';
  }
}
