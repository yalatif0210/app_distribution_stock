import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StockService } from '../../../core/services/stock.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { SaisieStock, Programme, PeriodeSaisie, Region } from '../../../core/models/models';

@Component({
  selector: 'app-tableau-bord',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <h1>Stocks — Vue d'ensemble</h1>
        <p>Historique et état des stocks par période et programme</p>
      </div>
      <div style="display:flex;gap:.5rem;">
        <a mat-stroked-button color="primary" routerLink="/stocks/saisie">
          <mat-icon>edit_note</mat-icon> Saisie manuelle
        </a>
        <a mat-stroked-button routerLink="/stocks/import">
          <mat-icon>upload_file</mat-icon> Import Excel
        </a>
      </div>
    </div>

    <!-- Filtres -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
        <mat-form-field appearance="fill" style="flex:1;min-width:180px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedPeriodeId" (selectionChange)="charger()">
            <mat-option [value]="null">-- Sélectionner --</mat-option>
            <mat-option *ngFor="let p of periodes" [value]="p.id">
              {{ p.libelle ?? (p.dateRas | date:'dd/MM/yyyy') }} ({{ p.statut }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:180px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId" (selectionChange)="charger()">
            <mat-option [value]="null">Tous</mat-option>
            <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:160px;">
          <mat-label>Région</mat-label>
          <mat-select [(ngModel)]="selectedRegionId" (selectionChange)="filtrerRegion()">
            <mat-option [value]="null">Toutes</mat-option>
            <mat-option *ngFor="let r of regions" [value]="r.id">{{ r.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:200px;">
          <mat-label>Rechercher</mat-label>
          <input matInput [(ngModel)]="recherche" (input)="filtrer()" placeholder="Structure, produit…">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </mat-card-content>
    </mat-card>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement des stocks…</span>
    </div>

    <ng-container *ngIf="!loading">
      <!-- Indicateurs KPI -->
      <div class="grid-4" style="margin-bottom:1.25rem;" *ngIf="saisies.length > 0">
        <div class="stat-card" style="border-left:3px solid #dc2626;">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;">Ruptures</div>
          <div class="stat-value" style="color:#dc2626;margin-top:.5rem;">{{ nbRupture }}</div>
          <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem;">MSD = 0</div>
        </div>
        <div class="stat-card" style="border-left:3px solid #ea580c;">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;">En tension</div>
          <div class="stat-value" style="color:#ea580c;margin-top:.5rem;">{{ nbTension }}</div>
          <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem;">MSD &lt; 1</div>
        </div>
        <div class="stat-card" style="border-left:3px solid #7c3aed;">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;">En surstock</div>
          <div class="stat-value" style="color:#7c3aed;margin-top:.5rem;">{{ nbSurstock }}</div>
          <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem;">MSD &gt; 4</div>
        </div>
        <div class="stat-card" style="border-left:3px solid #16a34a;">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;">Normaux</div>
          <div class="stat-value" style="color:#16a34a;margin-top:.5rem;">{{ nbNormal }}</div>
          <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem;">2 ≤ MSD ≤ 4</div>
        </div>
      </div>

      <!-- Prompt sélection période -->
      <div *ngIf="!selectedPeriodeId" style="text-align:center;padding:3rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;color:var(--text-secondary);">
        <mat-icon style="font-size:2.5rem;width:2.5rem;height:2.5rem;display:block;margin:0 auto .75rem;">calendar_today</mat-icon>
        Sélectionnez une période pour afficher les stocks
      </div>

      <!-- Table -->
      <mat-card *ngIf="selectedPeriodeId">
        <mat-card-header style="padding:.875rem 1rem .25rem;">
          <mat-card-title style="font-size:.95rem;">
            Saisies de stock ({{ dsTableau.data.length }})
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding:0;">
          <table mat-table [dataSource]="dsTableau" matSort style="width:100%;">

            <ng-container matColumnDef="structure">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Structure</th>
              <td mat-cell *matCellDef="let s" style="font-size:.875rem;">{{ s.structureNom }}</td>
            </ng-container>

            <ng-container matColumnDef="produit">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
              <td mat-cell *matCellDef="let s">
                <div style="font-size:.875rem;font-weight:500;">{{ s.produitNom }}</div>
                <div style="color:var(--text-secondary);font-size:.75rem;">{{ s.produitCode }} · {{ s.produitUnite }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="stock">
              <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Stock dispo</th>
              <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;font-size:.875rem;">{{ s.stockDisponible | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="unite">
              <th mat-header-cell *matHeaderCellDef>Unité</th>
              <td mat-cell *matCellDef="let s" style="font-size:.82rem;color:var(--text-secondary);">{{ s.produitUnite }}</td>
            </ng-container>

            <ng-container matColumnDef="cmm">
              <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">CMM</th>
              <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;font-size:.875rem;">{{ s.cmm | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="msd">
              <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">MSD</th>
              <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;font-size:.875rem;font-weight:700;" [style.color]="msdColor(s.msd)">
                {{ s.msd | number:'1.1-1' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="peremption">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Péremption</th>
              <td mat-cell *matCellDef="let s" style="font-size:.875rem;">{{ s.expireDate | date:'dd/MM/yyyy' }}</td>
            </ng-container>

            <ng-container matColumnDef="statut">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
              <td mat-cell *matCellDef="let s">
                <span [class]="'badge badge-' + s.statutStock.toLowerCase()">{{ s.statutStock }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
              <td mat-cell *matCellDef="let s">
                <span style="font-size:.72rem;font-weight:600;padding:.15rem .45rem;border-radius:.25rem;background:rgba(79,70,229,.1);color:var(--accent-color);">{{ s.source }}</span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td [attr.colspan]="displayedColumns.length" style="text-align:center;padding:2.5rem;color:var(--text-secondary);">
                <mat-icon style="display:block;margin:0 auto .75rem;font-size:2rem;width:2rem;height:2rem;">inventory_2</mat-icon>
                Aucune saisie trouvée
              </td>
            </tr>
          </table>
          <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        </mat-card-content>
      </mat-card>
    </ng-container>
  `
})
export class TableauBordComponent implements OnInit, AfterViewInit {
  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  regions: Region[] = [];
  saisies: SaisieStock[] = [];
  dsTableau = new MatTableDataSource<SaisieStock>([]);
  selectedPeriodeId: number | null = null;
  selectedProgrammeId: number | null = null;
  selectedRegionId: number | null = null;
  recherche = '';
  loading = false;

  displayedColumns = ['structure', 'produit', 'stock', 'unite', 'cmm', 'msd', 'peremption', 'statut', 'source'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  get nbRupture(): number  { return this.saisies.filter(s => s.statutStock === 'RUPTURE').length; }
  get nbTension(): number  { return this.saisies.filter(s => s.statutStock === 'TENSION').length; }
  get nbSurstock(): number { return this.saisies.filter(s => s.statutStock === 'SURSTOCK').length; }
  get nbNormal(): number   { return this.saisies.filter(s => s.statutStock === 'NORMAL').length; }

  constructor(private stockService: StockService, private referentielService: ReferentielService) {}

  ngOnInit(): void {
    this.referentielService.getPeriodes().subscribe(p => this.periodes = p);
    this.referentielService.getProgrammes().subscribe(p => this.programmes = p);
    this.referentielService.getRegions().subscribe(r => this.regions = r);
  }

  ngAfterViewInit(): void {
    this.dsTableau.paginator = this.paginator;
    this.dsTableau.sort = this.sort;
  }

  charger(): void {
    if (!this.selectedPeriodeId) { this.saisies = []; this.dsTableau.data = []; return; }
    this.loading = true;
    this.stockService.getSaisies(this.selectedPeriodeId, this.selectedProgrammeId ?? undefined).subscribe({
      next: data => { this.saisies = data; this.filtrer(); this.loading = false; },
      error: () => this.loading = false
    });
  }

  filtrerRegion(): void { this.filtrer(); }

  filtrer(): void {
    let result = this.saisies;
    if (this.selectedRegionId) {
      result = result.filter(s => s.structureRegionId === this.selectedRegionId);
    }
    if (this.recherche.trim()) {
      const q = this.recherche.toLowerCase();
      result = result.filter(s =>
        s.structureNom.toLowerCase().includes(q) ||
        s.produitNom.toLowerCase().includes(q) ||
        s.produitCode.toLowerCase().includes(q)
      );
    }
    this.dsTableau.data = result;
    this.dsTableau.paginator?.firstPage();
  }

  msdColor(msd: number): string {
    if (msd === 0)  return '#dc2626';
    if (msd < 1)    return '#ea580c';
    if (msd < 2)    return '#d97706';
    if (msd <= 4)   return '#16a34a';
    return '#7c3aed';
  }
}
