import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StructureProgrammeService } from '../../core/services/structure-programme.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { AuthService } from '../../core/auth/auth.service';
import { StructureProgramme, Programme, Structure } from '../../core/models/models';

interface StructureRow {
  structureId: number;
  structureCode: string;
  structureNom: string;
  structureType: string;
  programmes: { [programmeId: number]: { id: number | null; actif: boolean; loading: boolean } };
}

@Component({
  selector: 'app-structure-programme',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <!-- Header -->
    <div class="page-header" style="display:flex; align-items:flex-start; justify-content:space-between;">
      <div>
        <h1>Configuration Structures × Programmes</h1>
        <p>Activez ou désactivez les associations entre structures et programmes</p>
      </div>
      <button mat-stroked-button color="primary" (click)="load()" [disabled]="loading">
        <mat-icon>refresh</mat-icon> Actualiser
      </button>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement de la configuration…</span>
    </div>

    <!-- Legend -->
    <div *ngIf="!loading" style="display:flex; align-items:center; gap:1rem; font-size:.8rem; color:var(--text-secondary); margin-bottom:.75rem;">
      <div style="display:flex; align-items:center; gap:.4rem;">
        <span style="display:inline-block;width:28px;height:14px;background:var(--accent-color);border-radius:7px;"></span>
        <span>Actif</span>
      </div>
      <div style="display:flex; align-items:center; gap:.4rem;">
        <span style="display:inline-block;width:28px;height:14px;background:var(--border-color);border-radius:7px;"></span>
        <span>Inactif</span>
      </div>
      <mat-icon style="font-size:16px;width:16px;height:16px;">info</mat-icon>
      <span>Le changement est enregistré automatiquement</span>
    </div>

    <!-- Table -->
    <mat-card *ngIf="!loading" style="overflow:auto;">
      <mat-card-content style="overflow-x:auto; padding:0;">
        <div style="padding:.5rem 1rem .25rem;">
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Filtrer les structures</mat-label>
            <input matInput #fSP (input)="dsRows.filter=fSP.value.trim().toLowerCase(); dsRows.paginator?.firstPage()">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>
        <table mat-table [dataSource]="dsRows" matSort style="min-width:600px; width:100%;">

          <!-- Code -->
          <ng-container matColumnDef="code" sticky>
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="min-width:80px;">Code</th>
            <td mat-cell *matCellDef="let row" style="min-width:80px;">
              <code style="color:var(--accent-color);font-size:.78rem;">{{ row.structureCode }}</code>
            </td>
          </ng-container>

          <!-- Structure -->
          <ng-container matColumnDef="structure" sticky>
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="min-width:200px;">Structure</th>
            <td mat-cell *matCellDef="let row" style="min-width:200px;font-size:.875rem;">{{ row.structureNom }}</td>
          </ng-container>

          <!-- Type -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="min-width:100px;">Type</th>
            <td mat-cell *matCellDef="let row">
              <span style="background:rgba(129,140,248,.12);color:var(--accent-color);font-size:.68rem;padding:.12rem .4rem;border-radius:.25rem;font-weight:600;">
                {{ row.structureType }}
              </span>
            </td>
          </ng-container>

          <!-- Dynamic programme columns -->
          <ng-container *ngFor="let prog of programmes" [matColumnDef]="'prog_' + prog.id">
            <th mat-header-cell *matHeaderCellDef style="min-width:130px;text-align:center;">
              <div style="font-size:.75rem;font-weight:600;">{{ prog.code }}</div>
              <div style="font-size:.7rem;color:var(--text-secondary);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;">{{ prog.nom }}</div>
            </th>
            <td mat-cell *matCellDef="let row" style="text-align:center;vertical-align:middle;">
              <ng-container *ngIf="row.programmes[prog.id] as cell">
                <mat-spinner *ngIf="cell.loading" diameter="20"></mat-spinner>
                <mat-slide-toggle
                  *ngIf="!cell.loading"
                  [checked]="cell.actif"
                  (change)="onToggle(row, prog.id, cell, $event.checked)"
                  color="primary"
                ></mat-slide-toggle>
              </ng-container>
              <ng-container *ngIf="!row.programmes[prog.id]">
                <mat-slide-toggle
                  [checked]="false"
                  (change)="onNewAssociation(row, prog.id, $event.checked)"
                  color="primary"
                ></mat-slide-toggle>
              </ng-container>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

          <!-- Empty -->
          <tr class="mat-row" *matNoDataRow>
            <td [attr.colspan]="displayedColumns.length" style="text-align:center;padding:2rem;color:var(--text-secondary);">
              <mat-icon style="font-size:2rem;width:2rem;height:2rem;display:block;margin:0 auto .5rem;">table_chart</mat-icon>
              Aucune structure trouvée
            </td>
          </tr>
        </table>
        <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>
  `
})
export class StructureProgrammeComponent implements OnInit {
  dsRows = new MatTableDataSource<StructureRow>([]);
  programmes: Programme[] = [];
  loading = false;
  displayedColumns: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private snackBar = inject(MatSnackBar);

  constructor(
    private spService: StructureProgrammeService,
    private referentielService: ReferentielService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    Promise.all([
      this.referentielService.getProgrammes().toPromise(),
      this.spService.findByRegion(this.auth.regionId ?? undefined).toPromise()
    ]).then(([programmes, associations]) => {
      this.programmes = (programmes || []).filter(p => p.active);
      this.buildRows(associations || []);
      this.displayedColumns = ['code', 'structure', 'type', ...this.programmes.map(p => 'prog_' + p.id)];
      this.dsRows.filterPredicate = (row: StructureRow, filter: string) =>
        row.structureCode.toLowerCase().includes(filter) ||
        row.structureNom.toLowerCase().includes(filter) ||
        row.structureType.toLowerCase().includes(filter);
      this.loading = false;
      setTimeout(() => {
        this.dsRows.paginator = this.paginator;
        this.dsRows.sort = this.sort;
      }, 0);
    }).catch(() => {
      this.snackBar.open('Impossible de charger la configuration.', 'Fermer', { duration: 4000 });
      this.loading = false;
    });
  }

  private buildRows(associations: StructureProgramme[]): void {
    const structureMap = new Map<number, StructureRow>();

    for (const assoc of associations) {
      if (!structureMap.has(assoc.structureId)) {
        structureMap.set(assoc.structureId, {
          structureId: assoc.structureId,
          structureCode: assoc.structureCode,
          structureNom: assoc.structureNom,
          structureType: assoc.structureType,
          programmes: {}
        });
      }
      const row = structureMap.get(assoc.structureId)!;
      row.programmes[assoc.programmeId] = { id: assoc.id, actif: assoc.actif, loading: false };
    }

    this.dsRows.data = Array.from(structureMap.values()).sort((a, b) =>
      a.structureCode.localeCompare(b.structureCode)
    );
  }

  onToggle(
    row: StructureRow,
    programmeId: number,
    cell: { id: number | null; actif: boolean; loading: boolean },
    newValue: boolean
  ): void {
    if (cell.id === null) return;
    cell.loading = true;
    cell.actif = newValue;
    this.spService.update(cell.id, cell.actif).subscribe({
      next: (updated) => {
        cell.actif = updated.actif;
        cell.loading = false;
        this.snackBar.open(`Association ${cell.actif ? 'activée' : 'désactivée'} pour ${row.structureCode}.`, 'OK', { duration: 2000 });
      },
      error: () => {
        cell.actif = !cell.actif;
        cell.loading = false;
        this.snackBar.open('La mise à jour a échoué.', 'Fermer', { duration: 4000 });
      }
    });
  }

  onNewAssociation(row: StructureRow, programmeId: number, checked: boolean): void {
    if (!checked) return;
    row.programmes[programmeId] = { id: null, actif: true, loading: true };
    this.spService.createOrActivate({
      structureId: row.structureId,
      programmeId,
      actif: true
    }).subscribe({
      next: (created) => {
        row.programmes[programmeId] = { id: created.id, actif: created.actif, loading: false };
        this.snackBar.open(`${row.structureCode} associé au programme.`, 'OK', { duration: 2000 });
      },
      error: () => {
        delete row.programmes[programmeId];
        this.snackBar.open('La création de l\'association a échoué.', 'Fermer', { duration: 4000 });
      }
    });
  }
}
