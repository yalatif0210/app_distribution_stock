import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StockService } from '../../../core/services/stock.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { PeriodeService } from '../../../core/services/periode.service';
import { LigneErreur, SaisieStock, Programme, PeriodeSaisie } from '../../../core/models/models';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <h1>Import Excel — Stocks</h1>
        <p>Importez les données de stock depuis un fichier Excel</p>
      </div>
      <a mat-stroked-button routerLink="/stocks/tableau-bord">
        <mat-icon>arrow_back</mat-icon> Retour
      </a>
    </div>

    <!-- Formulaire -->
    <mat-card style="max-width:720px;margin-bottom:1.25rem;">
      <mat-card-header style="padding:.875rem 1rem .25rem;">
        <mat-card-title style="font-size:.95rem;">Paramètres d'import</mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding-top:.5rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem;">
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Période *</mat-label>
            <mat-select [(ngModel)]="periodeId">
              <mat-option [value]="null">-- Sélectionner --</mat-option>
              <mat-option *ngFor="let p of periodes" [value]="p.id">
                {{ p.libelle ?? (p.dateRas | date:'dd/MM/yyyy') }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Programme *</mat-label>
            <mat-select [(ngModel)]="programmeId">
              <mat-option [value]="null">-- Sélectionner --</mat-option>
              <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Étape 1 : télécharger le modèle -->
        <div *ngIf="programmeId" style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:rgba(79,70,229,.05);border:1px solid rgba(79,70,229,.2);border-radius:.375rem;margin-bottom:.75rem;">
          <mat-icon style="color:var(--accent-color);">download</mat-icon>
          <div style="flex:1;">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-primary);">Étape 1 — Télécharger le modèle Excel pré-rempli</div>
            <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.1rem;">Contient les produits de votre programme. Remplissez les colonnes Stock, CMM et Date péremption.</div>
          </div>
          <button mat-stroked-button color="primary" (click)="telechargerModele()" [disabled]="downloadingTemplate">
            <mat-spinner *ngIf="downloadingTemplate" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
            <mat-icon *ngIf="!downloadingTemplate">file_download</mat-icon>
            Télécharger le modèle
          </button>
        </div>

        <!-- Étape 2 : choisir le fichier rempli -->
        <div style="margin-bottom:1rem;">
          <div style="font-size:.825rem;font-weight:600;color:var(--text-secondary);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em;">
            Étape 2 — Importer le fichier rempli (.xlsx) *
          </div>
          <label style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1rem;border:2px dashed var(--border-color);border-radius:.375rem;cursor:pointer;transition:border-color .15s;"
                 [style.border-color]="fichier ? '#16a34a' : ''"
                 [style.background]="fichier ? '#f0fdf4' : '#f8fafc'">
            <mat-icon [style.color]="fichier ? '#16a34a' : 'var(--text-secondary)'">{{ fichier ? 'check_circle' : 'upload_file' }}</mat-icon>
            <div>
              <div style="font-size:.875rem;font-weight:500;" [style.color]="fichier ? '#15803d' : 'var(--text-primary)'">
                {{ fichier ? fichier.name : 'Cliquez pour sélectionner un fichier' }}
              </div>
              <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.1rem;">
                Utilisez uniquement le modèle téléchargé pour ce programme
              </div>
            </div>
            <input type="file" accept=".xlsx,.xls" (change)="onFile($event)" style="display:none;">
          </label>
        </div>

        <button mat-raised-button color="primary"
          (click)="importer()"
          [disabled]="!fichier || !periodeId || !programmeId || loading">
          <mat-spinner *ngIf="loading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!loading">upload</mat-icon>
          Importer
        </button>
      </mat-card-content>
    </mat-card>

    <!-- ── Rapport de rejet ── -->
    <mat-card *ngIf="erreurs.length > 0" style="margin-bottom:1.25rem;border:1px solid rgba(220,38,38,.3);">
      <mat-card-header style="padding:.875rem 1rem .25rem;background:rgba(220,38,38,.04);border-bottom:1px solid rgba(220,38,38,.15);">
        <mat-card-title style="display:flex;align-items:center;gap:.75rem;font-size:.95rem;color:#b91c1c;">
          <mat-icon style="color:#dc2626;">cancel</mat-icon>
          Import rejeté — {{ erreurs.length }} ligne(s) en erreur
        </mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding:.75rem 1rem;">
        <p style="font-size:.85rem;color:var(--text-secondary);margin:.25rem 0 .75rem;">
          Aucune ligne n'a été importée. Corrigez les erreurs ci-dessous dans le fichier Excel, puis relancez l'import.
        </p>

        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
            <thead>
              <tr style="background:#fef2f2;border-bottom:2px solid rgba(220,38,38,.2);">
                <th style="padding:.5rem .75rem;text-align:left;font-weight:700;color:#b91c1c;white-space:nowrap;">Ligne</th>
                <th style="padding:.5rem .75rem;text-align:left;font-weight:700;color:#b91c1c;">Code produit</th>
                <th style="padding:.5rem .75rem;text-align:left;font-weight:700;color:#b91c1c;">Règle violée</th>
                <th style="padding:.5rem .75rem;text-align:left;font-weight:700;color:#b91c1c;">Valeurs lues</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of erreurs" style="border-bottom:1px solid rgba(220,38,38,.1);">
                <td style="padding:.4rem .75rem;font-family:monospace;font-weight:600;">{{ e.numLigne }}</td>
                <td style="padding:.4rem .75rem;"><code style="color:var(--accent-color);">{{ e.produitCode || '—' }}</code></td>
                <td style="padding:.4rem .75rem;color:#991b1b;">{{ e.regle }}</td>
                <td style="padding:.4rem .75rem;color:var(--text-secondary);font-family:monospace;font-size:.78rem;">{{ e.valeurs }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top:.875rem;">
          <button mat-stroked-button color="warn" (click)="telechargerRapportErreurs()">
            <mat-icon>download</mat-icon>
            Télécharger le rapport d'erreurs (CSV)
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- ── Résultat succès ── -->
    <mat-card *ngIf="dsPreview.data.length > 0">
      <mat-card-header style="padding:.875rem 1rem .25rem;">
        <mat-card-title style="display:flex;align-items:center;gap:.75rem;font-size:.95rem;">
          <mat-icon style="color:#15803d;">check_circle</mat-icon>
          {{ dsPreview.data.length }} saisie(s) importée(s) avec succès
        </mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding:0 0 .5rem 0;">
        <div style="padding:.5rem 1rem .25rem;">
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Filtrer</mat-label>
            <input matInput #fPreview (input)="dsPreview.filter=fPreview.value.trim().toLowerCase(); dsPreview.paginator?.firstPage()">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>
        <table mat-table [dataSource]="dsPreview" matSort style="width:100%;">
          <ng-container matColumnDef="produit">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
            <td mat-cell *matCellDef="let s" style="font-size:.875rem;font-weight:500;">{{ s.produitNom }}</td>
          </ng-container>
          <ng-container matColumnDef="stock">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Stock dispo</th>
            <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;">{{ s.stockDisponible | number:'1.0-0' }}</td>
          </ng-container>
          <ng-container matColumnDef="cmm">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">CMM</th>
            <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;">{{ s.cmm | number:'1.0-0' }}</td>
          </ng-container>
          <ng-container matColumnDef="msd">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">MSD</th>
            <td mat-cell *matCellDef="let s" style="text-align:right;font-family:monospace;font-weight:600;">{{ s.msd | number:'1.1-1' }}</td>
          </ng-container>
          <ng-container matColumnDef="expireDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date péremption</th>
            <td mat-cell *matCellDef="let s" style="font-size:.82rem;">{{ s.expireDate ? (s.expireDate | date:'dd/MM/yyyy') : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
            <td mat-cell *matCellDef="let s">
              <span *ngIf="s.statutStock" [class]="'badge badge-' + s.statutStock.toLowerCase()">{{ s.statutStock }}</span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['produit','stock','cmm','msd','expireDate','statut']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['produit','stock','cmm','msd','expireDate','statut'];"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td>
          </tr>
        </table>
        <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>
  `
})
export class ImportComponent implements OnInit, AfterViewInit {
  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  periodeId: number | null = null;
  programmeId: number | null = null;
  fichier: File | null = null;
  dsPreview = new MatTableDataSource<SaisieStock>([]);
  erreurs: LigneErreur[] = [];
  loading = false;
  downloadingTemplate = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private snackBar = inject(MatSnackBar);

  constructor(
    private stockService: StockService,
    private refService: ReferentielService,
    private periodeService: PeriodeService
  ) {}

  ngOnInit(): void {
    this.periodeService.findByRegion().subscribe(p => this.periodes = p.filter(x => x.statut === 'OUVERTE'));
    this.refService.getProgrammes().subscribe(p => this.programmes = p);
  }

  ngAfterViewInit(): void {
    this.dsPreview.paginator = this.paginator;
    this.dsPreview.sort = this.sort;
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fichier = input.files?.[0] ?? null;
    // Réinitialiser les résultats précédents
    this.erreurs = [];
    this.dsPreview.data = [];
  }

  telechargerModele(): void {
    if (!this.programmeId) return;
    this.downloadingTemplate = true;
    this.stockService.downloadTemplate(this.programmeId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const prog = this.programmes.find(p => p.id === this.programmeId);
        a.download = `modele_stocks_${prog?.code ?? this.programmeId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingTemplate = false;
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Erreur lors du téléchargement.', 'Fermer', { duration: 4000 });
        this.downloadingTemplate = false;
      }
    });
  }

  importer(): void {
    if (!this.fichier || !this.periodeId || !this.programmeId) return;
    this.loading = true;
    this.erreurs = [];
    this.dsPreview.data = [];

    this.stockService.importExcel(this.fichier, this.periodeId, this.programmeId).subscribe({
      next: resultat => {
        this.loading = false;
        if (!resultat.success) {
          this.erreurs = resultat.erreurs;
          this.snackBar.open(
            `Import rejeté — ${resultat.erreurs.length} erreur(s) détectée(s). Aucune ligne importée.`,
            'Fermer', { duration: 6000 }
          );
        } else {
          this.dsPreview.data = resultat.importes;
          this.snackBar.open(`${resultat.nbImportes} saisie(s) importée(s) avec succès.`, 'OK', { duration: 3000 });
        }
      },
      error: err => {
        this.snackBar.open(err.error?.message || "Erreur lors de l'import.", 'Fermer', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  telechargerRapportErreurs(): void {
    if (!this.erreurs.length) return;
    const bom = '﻿';
    const header = 'Ligne,Code Produit,Règle violée,Valeurs lues';
    const rows = this.erreurs.map(e =>
      `${e.numLigne},"${e.produitCode ?? ''}","${e.regle}","${e.valeurs}"`
    );
    const csv = bom + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapport_erreurs_import.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
