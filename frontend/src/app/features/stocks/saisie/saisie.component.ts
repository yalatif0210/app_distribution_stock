import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { StockService } from '../../../core/services/stock.service';
import { PeriodeService } from '../../../core/services/periode.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EtatStock, LigneSaisie, PeriodeSaisie, Programme } from '../../../core/models/models';

@Component({
  selector: 'app-saisie',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule, MatPaginatorModule,
    MatDialogModule, MatDividerModule
  ],
  template: `
    <!-- Header -->
    <div class="page-header">
      <h1>Saisie d'état de stock</h1>
      <p>{{ auth.currentUser?.username }} — {{ etat?.structureNom ?? 'Chargement…' }}</p>
    </div>

    <!-- Step 1 : Sélection période + programme -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
        <mat-form-field appearance="fill" style="flex:1;min-width:220px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedPeriodeId" [disabled]="loading || !!etat" (ngModelChange)="erreurSaisie = ''">
            <mat-option [value]="null">— Choisir —</mat-option>
            <mat-option *ngFor="let p of periodes" [value]="p.id">
              {{ p.libelle ?? (p.dateRas | date:'dd/MM/yyyy') }} ({{ p.statut }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1;min-width:220px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId" [disabled]="loading || !!etat" (ngModelChange)="erreurSaisie = ''">
            <mat-option [value]="null">— Choisir —</mat-option>
            <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary"
          [disabled]="!selectedPeriodeId || !selectedProgrammeId || loading"
          (click)="commencerSaisie()"
          style="height:56px;padding:0 1.5rem;">
          <mat-spinner *ngIf="loading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!loading">play_arrow</mat-icon>
          {{ etat ? 'Rechargé' : 'Commencer la saisie' }}
        </button>

        <button mat-stroked-button *ngIf="etat" (click)="resetSelection()" style="height:56px;">
          <mat-icon>close</mat-icon> Changer
        </button>
      </mat-card-content>

      <!-- Bannière erreur saisie déjà soumise -->
      <div *ngIf="erreurSaisie"
        style="display:flex;align-items:flex-start;gap:.75rem;padding:.875rem 1.25rem;
               background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.3);
               border-radius:.5rem;margin:.75rem 1rem 1rem;color:#b91c1c;">
        <mat-icon style="color:#dc2626;flex-shrink:0;margin-top:.1rem;">block</mat-icon>
        <div>
          <strong style="display:block;margin-bottom:.2rem;">Saisie impossible</strong>
          <span style="font-size:.875rem;">{{ erreurSaisie }}</span>
        </div>
      </div>
    </mat-card>

    <!-- Etat chargé -->
    <ng-container *ngIf="etat">

      <!-- Bannière statut -->
      <div *ngIf="etat.statut === 'SUBMITTED'"
        style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.25);border-radius:.5rem;margin-bottom:1rem;">
        <mat-icon style="color:#16a34a;">check_circle</mat-icon>
        <div>
          <strong style="color:#15803d;">État soumis — lecture seule</strong>
          <div style="font-size:.8rem;color:var(--text-secondary);">
            Soumis le {{ etat.dateSoumission | date:'dd/MM/yyyy à HH:mm' }}
          </div>
        </div>
      </div>

      <div *ngIf="etat.statut === 'SUGGESTED'"
        style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;background:rgba(202,138,4,.06);border:1px solid rgba(202,138,4,.2);border-radius:.5rem;margin-bottom:1rem;">
        <mat-icon style="color:#a16207;">edit_note</mat-icon>
        <span style="font-size:.875rem;color:#a16207;font-weight:500;">Brouillon — les modifications sont sauvegardées automatiquement à chaque ligne</span>
      </div>

      <!-- Aucun produit configuré -->
      <div *ngIf="etat.lignes.length === 0"
        style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;background:rgba(202,138,4,.06);border:1px solid rgba(202,138,4,.2);border-radius:.5rem;margin-bottom:1rem;">
        <mat-icon style="color:#a16207;">info</mat-icon>
        <span style="font-size:.875rem;color:#a16207;">
          Aucun produit configuré pour ce programme.
          Rendez-vous dans <strong>Sélection des produits gérés</strong> pour activer les produits de votre structure.
        </span>
      </div>

      <!-- Table produits -->
      <mat-card *ngIf="etat.lignes.length > 0">
        <mat-card-header style="padding:.875rem 1rem .25rem;">
          <mat-card-title style="font-size:.95rem;display:flex;align-items:center;gap:.75rem;">
            <span>{{ etat.programmeNom }} — {{ etat.periodeLibelle }}</span>
            <span style="font-size:.8rem;font-weight:400;color:var(--text-secondary);">
              {{ lignesSaved }}/{{ etat.lignes.length }} lignes renseignées
            </span>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content style="padding:0;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:900px;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:2px solid var(--border-color);">
                <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;">Code</th>
                <th style="padding:.6rem 1rem;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Produit</th>
                <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;">Unité</th>
                <th style="padding:.6rem .75rem;text-align:right;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;">Stock dispo *</th>
                <th style="padding:.6rem .75rem;text-align:right;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">CMM</th>
                <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;">Date péremption</th>
                <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">MSD</th>
                <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Statut</th>
                <th style="padding:.6rem .75rem;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);">Action</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let ligne of lignesPage">
                <tr [style.background]="ligne.risquePeremption ? 'rgba(217,119,6,.05)' : ''"
                    style="border-bottom:1px solid var(--border-color);">

                  <!-- Code -->
                  <td style="padding:.5rem 1rem;">
                    <code style="font-size:.75rem;color:var(--accent-color);">{{ ligne.produitCode }}</code>
                  </td>

                  <!-- Nom produit -->
                  <td style="padding:.5rem 1rem;">
                    <span style="font-size:.875rem;font-weight:500;">{{ ligne.produitNom }}</span>
                  </td>

                  <!-- Unité -->
                  <td style="padding:.5rem .75rem;text-align:center;">
                    <span style="font-size:.78rem;color:var(--text-secondary);">{{ ligne.produitUnite }}</span>
                  </td>

                  <!-- Stock disponible -->
                  <td style="padding:.5rem .75rem;text-align:right;">
                    <input *ngIf="etat.statut === 'SUGGESTED'"
                      type="number" min="0" step="1"
                      [(ngModel)]="ligne.stockDisponible"
                      (blur)="autoSaveLigne(ligne)"
                      style="width:90px;text-align:right;border:1px solid var(--border-color);border-radius:.25rem;padding:.25rem .5rem;font-size:.875rem;font-family:monospace;">
                    <span *ngIf="etat.statut === 'SUBMITTED'"
                      style="font-family:monospace;font-size:.875rem;">
                      {{ ligne.stockDisponible ?? '—' }}
                    </span>
                  </td>

                  <!-- CMM -->
                  <td style="padding:.5rem .75rem;text-align:right;">
                    <input *ngIf="etat.statut === 'SUGGESTED'"
                      type="number" min="0" step="0.01"
                      [(ngModel)]="ligne.cmm"
                      (blur)="autoSaveLigne(ligne)"
                      style="width:90px;text-align:right;border:1px solid var(--border-color);border-radius:.25rem;padding:.25rem .5rem;font-size:.875rem;font-family:monospace;">
                    <span *ngIf="etat.statut === 'SUBMITTED'"
                      style="font-family:monospace;font-size:.875rem;">
                      {{ ligne.cmm ?? '—' }}
                    </span>
                  </td>

                  <!-- Date péremption -->
                  <td style="padding:.5rem .75rem;text-align:center;">
                    <input *ngIf="etat.statut === 'SUGGESTED'"
                      type="date"
                      [(ngModel)]="ligne.expireDate"
                      (blur)="autoSaveLigne(ligne)"
                      [style.border-color]="(needsExpireDate(ligne) || expireDateInvalid(ligne)) ? '#dc2626' : 'var(--border-color)'"
                      style="border:1px solid var(--border-color);border-radius:.25rem;padding:.25rem .5rem;font-size:.8rem;">
                    <span *ngIf="etat.statut === 'SUBMITTED'" style="font-size:.8rem;">
                      {{ ligne.expireDate ? (ligne.expireDate | date:'dd/MM/yyyy') : '—' }}
                    </span>
                    <div *ngIf="needsExpireDate(ligne)" style="font-size:.65rem;color:#dc2626;margin-top:.15rem;">Obligatoire si stock > 0</div>
                    <div *ngIf="expireDateInvalid(ligne)" style="font-size:.65rem;color:#dc2626;margin-top:.15rem;">Doit être postérieure à la date de saisie</div>
                    <div *ngIf="ligne.risquePeremption && ligne.surplusMois"
                      style="font-size:.65rem;color:#d97706;background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.3);border-radius:.2rem;padding:.1rem .35rem;margin-top:.2rem;font-weight:600;">
                      ⚠ Surplus : {{ ligne.surplusMois | number:'1.1-1' }} mois
                    </div>
                  </td>

                  <!-- MSD calculé -->
                  <td style="padding:.5rem .75rem;text-align:center;">
                    <span *ngIf="getMsd(ligne) !== null"
                      [style.color]="msdColor(getMsd(ligne)!)"
                      style="font-family:monospace;font-weight:700;font-size:.875rem;">
                      {{ getMsd(ligne)! | number:'1.1-1' }}
                    </span>
                    <span *ngIf="getMsd(ligne) === null" style="color:var(--text-secondary);font-size:.8rem;">—</span>
                  </td>

                  <!-- Statut stock -->
                  <td style="padding:.5rem .75rem;text-align:center;">
                    <span *ngIf="ligne.saved && ligne.statutStock"
                      [class]="'badge badge-' + (ligne.statutStock || '').toLowerCase().replace('_', '-')" style="font-size:.65rem;">
                      {{ statutLabel(ligne.statutStock) }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td style="padding:.5rem .75rem;text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:.3rem;">
                      <mat-spinner *ngIf="ligne._saving" diameter="16"></mat-spinner>
                      <mat-icon *ngIf="!ligne._saving && ligne.saved && etat.statut === 'SUGGESTED'"
                        style="font-size:14px;width:14px;height:14px;color:#16a34a;" matTooltip="Ligne sauvegardée">
                        check_circle
                      </mat-icon>
                    </div>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </mat-card-content>

        <!-- Paginator -->
        <mat-paginator
          [length]="etat.lignes.length"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 25]"
          (page)="onPage($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>

      <!-- Footer actions -->
      <div *ngIf="etat.lignes.length > 0"
        style="display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-top:1rem;padding:.875rem 0;">
        <div *ngIf="hasValidationErrors()" style="color:#dc2626;font-size:.875rem;display:flex;align-items:center;gap:.35rem;">
          <mat-icon style="font-size:16px;width:16px;height:16px;">warning</mat-icon>
          {{ validationErrorCount() }} ligne(s) avec date de péremption manquante
        </div>

        <button mat-raised-button color="primary"
          *ngIf="etat.statut === 'SUGGESTED'"
          [disabled]="submitting || hasValidationErrors()"
          (click)="soumettre()"
          style="min-width:200px;">
          <mat-spinner *ngIf="submitting" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!submitting">send</mat-icon>
          Soumettre l'état définitivement
        </button>
      </div>
    </ng-container>
  `
})
export class SaisieComponent implements OnInit {
  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  etat: (EtatStock & { lignes: (LigneSaisie & { _saving?: boolean })[] }) | null = null;
  selectedPeriodeId: number | null = null;
  selectedProgrammeId: number | null = null;
  loading = false;
  submitting = false;
  erreurSaisie = '';

  pageSize = 10;
  pageIndex = 0;

  private snackBar = inject(MatSnackBar);

  constructor(
    public auth: AuthService,
    private stockService: StockService,
    private periodeService: PeriodeService,
    private referentielService: ReferentielService
  ) {}

  ngOnInit(): void {
    this.periodeService.findByRegion().subscribe(p => {
      this.periodes = p.filter(x => x.statut === 'OUVERTE');
    });
    this.referentielService.getProgrammes().subscribe(p => {
      this.programmes = p.filter(x => x.active);
    });
  }

  commencerSaisie(): void {
    if (!this.selectedPeriodeId || !this.selectedProgrammeId || !this.auth.structureId) return;
    this.loading = true;
    this.erreurSaisie = '';
    this.stockService.initEtat(this.selectedPeriodeId, this.selectedProgrammeId, this.auth.structureId).subscribe({
      next: etat => {
        this.etat = { ...etat, lignes: etat.lignes.map(l => ({ ...l, _saving: false })) };
        this.pageIndex = 0;
        this.loading = false;
      },
      error: err => {
        const msg: string = err.error?.message || '';
        this.erreurSaisie = msg || 'Impossible d\'initialiser la saisie. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  resetSelection(): void {
    this.etat = null;
    this.selectedPeriodeId = null;
    this.selectedProgrammeId = null;
    this.pageIndex = 0;
    this.erreurSaisie = '';
  }

  get lignesPage(): (LigneSaisie & { _saving?: boolean })[] {
    if (!this.etat) return [];
    const start = this.pageIndex * this.pageSize;
    return this.etat.lignes.slice(start, start + this.pageSize);
  }

  onPage(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
  }

  get lignesSaved(): number {
    return this.etat?.lignes.filter(l => l.saved).length ?? 0;
  }

  autoSaveLigne(ligne: LigneSaisie & { _saving?: boolean }): void {
    if (!this.etat?.id || this.etat.statut !== 'SUGGESTED') return;
    if (this.needsExpireDate(ligne) || this.expireDateInvalid(ligne)) return;

    ligne._saving = true;
    this.stockService.saveLigne({
      etatId: this.etat.id!,
      produitId: ligne.produitId,
      stockDisponible: ligne.stockDisponible,
      cmm: ligne.cmm,
      expireDate: ligne.expireDate
    }).subscribe({
      next: updated => {
        Object.assign(ligne, updated);
        ligne._saving = false;
      },
      error: err => {
        ligne._saving = false;
        this.snackBar.open(err.error?.message || 'Erreur de sauvegarde.', 'Fermer', { duration: 3000 });
      }
    });
  }

  soumettre(): void {
    if (!this.etat?.id || this.hasValidationErrors()) return;
    this.submitting = true;
    this.stockService.submitEtat(this.etat.id).subscribe({
      next: etat => {
        this.etat = { ...etat, lignes: etat.lignes.map(l => ({ ...l, _saving: false })) };
        this.submitting = false;
        this.snackBar.open('État soumis avec succès.', 'OK', { duration: 3000 });
      },
      error: err => {
        this.submitting = false;
        this.snackBar.open(err.error?.message || 'Erreur lors de la soumission.', 'Fermer', { duration: 4000 });
      }
    });
  }

  needsExpireDate(ligne: LigneSaisie): boolean {
    return ligne.stockDisponible !== null
      && ligne.stockDisponible > 0
      && !ligne.expireDate;
  }

  expireDateInvalid(ligne: LigneSaisie): boolean {
    if (!ligne.expireDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return ligne.expireDate <= today;
  }

  hasValidationErrors(): boolean {
    return this.etat?.lignes.some(l => this.needsExpireDate(l) || this.expireDateInvalid(l)) ?? false;
  }

  validationErrorCount(): number {
    return this.etat?.lignes.filter(l => this.needsExpireDate(l) || this.expireDateInvalid(l)).length ?? 0;
  }

  getMsd(ligne: LigneSaisie): number | null {
    if (ligne.statutStock === 'STOCK_DORMANT') return null;
    if (ligne.cmm && ligne.cmm > 0 && ligne.stockDisponible !== null) {
      return Math.round((ligne.stockDisponible / ligne.cmm) * 10) / 10;
    }
    return ligne.msd;
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
