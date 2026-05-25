import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { StockService } from '../../../core/services/stock.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Programme, ProduitSelection } from '../../../core/models/models';

@Component({
  selector: 'app-selection-produits',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatSnackBarModule, MatIconModule
  ],
  template: `
    <div class="page-header">
      <h1>Sélection des produits gérés</h1>
      <p>{{ auth.currentUser?.username }}</p>
    </div>

    <!-- Sélection programme -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="padding-top:.75rem;">
        <mat-form-field appearance="fill" style="width:100%;max-width:480px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId" (ngModelChange)="onProgrammeChange($event)">
            <mat-option [value]="null">— Choisir un programme —</mat-option>
            <mat-option *ngFor="let p of programmes" [value]="p.id">
              {{ p.code }} — {{ p.nom }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <div *ngIf="programmes.length === 0 && !loadingProgrammes"
          style="font-size:.875rem;color:var(--text-secondary);margin-top:.5rem;">
          Aucun programme actif pour cette structure.
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Liste des produits -->
    <mat-card *ngIf="selectedProgrammeId">
      <mat-card-header style="padding:.875rem 1rem .25rem;">
        <mat-card-title style="font-size:.95rem;display:flex;align-items:center;gap:.75rem;">
          <span>Produits du programme</span>
          <span *ngIf="!loadingProduits" style="font-size:.8rem;font-weight:400;color:var(--text-secondary);">
            {{ totalActifs }}/{{ produits.length }} actifs
          </span>
          <mat-spinner *ngIf="loadingProduits" diameter="18"></mat-spinner>
        </mat-card-title>
      </mat-card-header>

      <mat-card-content style="padding:0;">

        <div *ngIf="!loadingProduits && produits.length === 0"
          style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:.875rem;">
          <mat-icon style="font-size:32px;width:32px;height:32px;display:block;margin:0 auto .5rem;">inventory_2</mat-icon>
          Aucun produit dans ce programme.
        </div>

        <table *ngIf="!loadingProduits && produits.length > 0"
          style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid var(--border-color);">
              <th style="padding:.6rem 1rem;width:48px;"></th>
              <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;">Code</th>
              <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Produit</th>
              <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Unité</th>
              <th style="padding:.6rem .75rem;width:32px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of produits"
              style="border-bottom:1px solid var(--border-color);"
              [style.background]="p.actif ? 'rgba(22,163,74,.03)' : 'transparent'">

              <td style="padding:.5rem 1rem;">
                <mat-checkbox
                  [checked]="p.actif"
                  [disabled]="toggling.has(p.produitId)"
                  (change)="toggle(p, $event.checked)">
                </mat-checkbox>
              </td>

              <td style="padding:.5rem 1rem;">
                <code style="font-size:.75rem;color:var(--accent-color);">{{ p.produitCode }}</code>
              </td>

              <td style="padding:.5rem 1rem;">
                <span style="font-size:.875rem;" [style.font-weight]="p.actif ? '600' : '400'">
                  {{ p.produitNom }}
                </span>
              </td>

              <td style="padding:.5rem .75rem;text-align:center;">
                <span style="font-size:.78rem;color:var(--text-secondary);">{{ p.produitUnite }}</span>
              </td>

              <td style="padding:.5rem .75rem;text-align:center;">
                <mat-spinner *ngIf="toggling.has(p.produitId)" diameter="16"></mat-spinner>
                <mat-icon *ngIf="!toggling.has(p.produitId) && p.actif"
                  style="font-size:14px;width:14px;height:14px;color:#16a34a;">
                  check_circle
                </mat-icon>
              </td>
            </tr>
          </tbody>
        </table>
      </mat-card-content>
    </mat-card>
  `
})
export class SelectionProduitsComponent implements OnInit {
  programmes: Programme[] = [];
  selectedProgrammeId: number | null = null;
  produits: ProduitSelection[] = [];
  loadingProgrammes = false;
  loadingProduits = false;
  toggling = new Set<number>();

  private snackBar = inject(MatSnackBar);

  constructor(
    public auth: AuthService,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    if (!this.auth.structureId) return;
    this.loadingProgrammes = true;
    this.stockService.getProgrammesActifs(this.auth.structureId).subscribe({
      next: progs => {
        this.programmes = progs;
        this.loadingProgrammes = false;
        if (progs.length === 1) {
          this.selectedProgrammeId = progs[0].id;
          this.loadProduits();
        }
      },
      error: () => { this.loadingProgrammes = false; }
    });
  }

  onProgrammeChange(programmeId: number | null): void {
    this.produits = [];
    if (programmeId) this.loadProduits();
  }

  loadProduits(): void {
    if (!this.auth.structureId || !this.selectedProgrammeId) return;
    this.loadingProduits = true;
    this.stockService.getSelectionProduits(this.auth.structureId, this.selectedProgrammeId).subscribe({
      next: produits => { this.produits = produits; this.loadingProduits = false; },
      error: () => { this.loadingProduits = false; }
    });
  }

  toggle(produit: ProduitSelection, checked: boolean): void {
    if (this.toggling.has(produit.produitId)) return;
    produit.actif = checked;
    this.toggling.add(produit.produitId);

    this.stockService.toggleSelectionProduit(
      this.auth.structureId!, this.selectedProgrammeId!, produit.produitId, checked
    ).subscribe({
      next: updated => {
        produit.actif = updated.actif;
        this.toggling.delete(produit.produitId);
      },
      error: () => {
        produit.actif = !checked;
        this.toggling.delete(produit.produitId);
        this.snackBar.open('Erreur lors de la modification.', 'Fermer', { duration: 3000 });
      }
    });
  }

  get totalActifs(): number {
    return this.produits.filter(p => p.actif).length;
  }
}
