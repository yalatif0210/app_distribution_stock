import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ParametreService } from '../../core/services/parametre.service';
import { SeuilsStatut, SeuilsStatutService } from '../../core/services/seuils-statut.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { AuthService } from '../../core/auth/auth.service';
import { Region } from '../../core/models/models';

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatSelectModule, MatTooltipModule
  ],
  template: `
    <div class="page-header">
      <h1>Paramètres</h1>
      <p>Configurez les seuils de gestion des stocks</p>
    </div>

    <div style="max-width:600px;">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon style="vertical-align:middle; margin-right:.5rem;">tune</mat-icon>
            Seuil de stock de sécurité (MSD)
          </mat-card-title>
          <mat-card-subtitle>
            Valeur minimale de Mois de Stock Disponible qu'une source doit conserver après redistribution (règle R1)
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content style="padding-top:1.5rem;">

          <!-- Région selector pour admin -->
          <mat-form-field *ngIf="auth.isAdmin()" appearance="fill" style="width:100%; margin-bottom:1rem;">
            <mat-label>Région</mat-label>
            <mat-select [(ngModel)]="selectedRegionId" (ngModelChange)="onRegionChange($event)">
              <mat-option *ngFor="let r of regions" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>

          <div *ngIf="loading" style="text-align:center; padding:2rem;">
            <mat-spinner diameter="40" style="margin:auto;"></mat-spinner>
          </div>

          <ng-container *ngIf="!loading && parametre !== null">
            <div style="margin-bottom:1rem; color:var(--text-secondary); font-size:.875rem;">
              <mat-icon style="font-size:1rem; vertical-align:middle; color:var(--accent-color);">location_on</mat-icon>
              Région : <strong>{{ parametre.regionNom }}</strong>
            </div>

            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Seuil stock de sécurité MSD</mat-label>
              <input matInput type="number" [(ngModel)]="editSeuil"
                     min="0.5" max="12" step="0.5"
                     [disabled]="saving" />
              <mat-hint>Valeur entre 0.5 et 12 mois. Valeur actuelle enregistrée : <strong>{{ parametre.seuilStockSecuriteMsd }} MSD</strong></mat-hint>
              <mat-error *ngIf="editSeuil !== null && (editSeuil < 0.5 || editSeuil > 12)">
                La valeur doit être comprise entre 0.5 et 12
              </mat-error>
            </mat-form-field>

            <div style="margin-top:1rem; padding:1rem; background:#f0f4ff; border-radius:8px; font-size:.85rem; color:#3730a3;">
              <mat-icon style="font-size:1rem; vertical-align:middle;">info</mat-icon>
              Un site source doit conserver un MSD résiduel ≥ <strong>{{ editSeuil }}</strong> après allocation.
              Toute redistribution qui ferait tomber le stock en dessous de ce seuil est refusée par le système.
            </div>

            <div *ngIf="erreur" style="margin-top:1rem; color:#dc2626; font-size:.875rem;">
              <mat-icon style="font-size:1rem; vertical-align:middle;">error</mat-icon> {{ erreur }}
            </div>
          </ng-container>
        </mat-card-content>

        <mat-card-actions align="end" style="padding:1rem 1.5rem;" *ngIf="!loading && parametre !== null">
          <button mat-stroked-button (click)="annuler()" [disabled]="saving">Annuler</button>
          <button mat-flat-button color="primary" (click)="sauvegarder()"
                  [disabled]="saving || editSeuil === null || editSeuil < 0.5 || editSeuil > 12"
                  style="margin-left:.75rem;">
            <mat-spinner *ngIf="saving" diameter="18" style="display:inline-block; margin-right:.5rem;"></mat-spinner>
            <mat-icon *ngIf="!saving">save</mat-icon>
            Enregistrer
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Seuils des statuts de stock (admin) -->
      <mat-card *ngIf="auth.isAdmin()" style="margin-top:1.5rem;">
        <mat-card-header>
          <mat-card-title>
            <mat-icon style="vertical-align:middle; margin-right:.5rem;">rule</mat-icon>
            Seuils des statuts de stock
          </mat-card-title>
          <mat-card-subtitle>
            Communs à toutes les régions. Ils donnent la couleur et le libellé des stocks dans les vues ;
            ils ne décident pas quelles sources peuvent céder (c'est le seuil de sécurité ci-dessus).
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content style="padding-top:1.25rem;">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;">
            <mat-form-field appearance="fill">
              <mat-label>Tension en dessous de</mat-label>
              <input matInput type="number" min="0.1" step="0.5" [(ngModel)]="editStatuts.tension" [disabled]="savingStatuts">
              <span matTextSuffix>mois</span>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>À surveiller en dessous de</mat-label>
              <input matInput type="number" min="0.1" step="0.5" [(ngModel)]="editStatuts.surveiller" [disabled]="savingStatuts">
              <span matTextSuffix>mois</span>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Surstock au-delà de</mat-label>
              <input matInput type="number" min="0.1" max="24" step="0.5" [(ngModel)]="editStatuts.surstock" [disabled]="savingStatuts">
              <span matTextSuffix>mois</span>
            </mat-form-field>
          </div>
          <div style="font-size:.82rem;color:var(--text-secondary);line-height:1.7;">
            Rupture : MSD = 0 · Tension : MSD &lt; {{ editStatuts.tension }} ·
            À surveiller : MSD &lt; {{ editStatuts.surveiller }} ·
            Bien stocké : jusqu'à {{ editStatuts.surstock }} · Surstock : au-delà
          </div>
          <div *ngIf="!statutsValides" style="margin-top:.5rem;color:#dc2626;font-size:.85rem;">
            Les seuils doivent respecter 0 &lt; tension &lt; à surveiller &lt; surstock ≤ 24 mois.
          </div>
          <div *ngIf="erreurStatuts" style="margin-top:.5rem;color:#dc2626;font-size:.85rem;">{{ erreurStatuts }}</div>
          <div style="margin-top:.75rem;font-size:.8rem;color:#92400e;">
            Le statut de toutes les saisies existantes, y compris des périodes passées, est recalculé à l'enregistrement.
          </div>
        </mat-card-content>
        <mat-card-actions align="end" style="padding:1rem 1.5rem;">
          <button mat-stroked-button (click)="annulerStatuts()" [disabled]="savingStatuts">Annuler</button>
          <button mat-flat-button color="primary" (click)="sauvegarderStatuts()"
                  [disabled]="savingStatuts || !statutsValides" style="margin-left:.75rem;">
            <mat-icon>save</mat-icon> Enregistrer
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Aide contextuelle -->
      <mat-card style="margin-top:1.5rem; background:#fffbeb; border:1px solid #fcd34d;">
        <mat-card-content style="padding:1rem;">
          <div style="font-weight:600; margin-bottom:.5rem; color:#92400e;">
            <mat-icon style="vertical-align:middle; margin-right:.25rem; color:#b45309;">help_outline</mat-icon>
            À quoi sert ce seuil ?
          </div>
          <ul style="margin:0; padding-left:1.25rem; font-size:.85rem; color:#78350f; line-height:1.8;">
            <li><strong>MSD (Mois de Stock Disponible)</strong> = stock disponible ÷ consommation mensuelle moyenne</li>
            <li>Dans un plan, généré par l'IA ou construit à la main, tout site dont le MSD dépasse ce seuil peut servir de source, quel que soit son statut, et ne cède que ce qui dépasse le seuil</li>
            <li>Par exemple, avec un seuil de <strong>2 MSD</strong>, un site qui a 5 mois de stock peut en redistribuer jusqu'à 3 mois, et un site qui en a 3 peut en céder 1</li>
            <li><strong>Exception péremption</strong> : si le lot d'un site périmera avant d'être consommé, la part qui périmera peut être cédée même si le site passe sous le seuil</li>
            <li>Augmenter ce seuil protège davantage les sources mais réduit les possibilités de redistribution</li>
          </ul>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class ParametresComponent implements OnInit {
  parametre: { regionId: number; regionNom: string; seuilStockSecuriteMsd: number } | null = null;
  editSeuil: number | null = null;
  loading = false;
  saving = false;
  erreur = '';
  regions: Region[] = [];
  selectedRegionId: number | null = null;

  // Seuils des statuts de stock (admin)
  private seuilsStatut = inject(SeuilsStatutService);
  editStatuts: SeuilsStatut = { ...this.seuilsStatut.seuils };
  savingStatuts = false;
  erreurStatuts = '';

  get statutsValides(): boolean {
    const s = this.editStatuts;
    return [s.tension, s.surveiller, s.surstock].every(v => v !== null && v !== undefined && !isNaN(v))
        && s.tension > 0 && s.tension < s.surveiller && s.surveiller < s.surstock && s.surstock <= 24;
  }

  chargerSeuilsStatut(): void {
    this.seuilsStatut.charger().subscribe(s => this.editStatuts = { ...s });
  }

  annulerStatuts(): void {
    this.editStatuts = { ...this.seuilsStatut.seuils };
    this.erreurStatuts = '';
  }

  sauvegarderStatuts(): void {
    if (!this.statutsValides) return;
    this.savingStatuts = true;
    this.erreurStatuts = '';
    this.seuilsStatut.modifier(this.editStatuts).subscribe({
      next: s => {
        this.editStatuts = { ...s };
        this.savingStatuts = false;
        this.snackBar.open('Seuils des statuts enregistrés.', 'OK', { duration: 3000 });
      },
      error: err => {
        this.erreurStatuts = err.error?.message || 'Erreur lors de la sauvegarde.';
        this.savingStatuts = false;
      }
    });
  }

  constructor(
    private parametreService: ParametreService,
    private referentielService: ReferentielService,
    public auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.auth.isAdmin()) {
      this.chargerSeuilsStatut();
      this.referentielService.getRegions().subscribe(regions => {
        this.regions = regions;
        if (regions.length > 0) {
          this.selectedRegionId = regions[0].id;
          this.charger(this.selectedRegionId);
        }
      });
    } else {
      this.charger();
    }
  }

  onRegionChange(regionId: number): void {
    this.charger(regionId);
  }

  charger(regionId?: number): void {
    this.loading = true;
    this.erreur = '';
    this.parametreService.getParametres(regionId).subscribe({
      next: p => {
        this.parametre = p;
        this.editSeuil = p.seuilStockSecuriteMsd;
        this.loading = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les paramètres.';
        this.loading = false;
      }
    });
  }

  annuler(): void {
    if (this.parametre) this.editSeuil = this.parametre.seuilStockSecuriteMsd;
    this.erreur = '';
  }

  sauvegarder(): void {
    if (this.editSeuil === null || this.editSeuil < 0.5 || this.editSeuil > 12) return;
    this.saving = true;
    this.erreur = '';
    const regionId = this.auth.isAdmin() ? (this.selectedRegionId ?? undefined) : undefined;
    this.parametreService.updateParametres(this.editSeuil, regionId ?? undefined).subscribe({
      next: updated => {
        this.parametre = updated;
        this.editSeuil = updated.seuilStockSecuriteMsd;
        this.saving = false;
        this.snackBar.open('Paramètres enregistrés avec succès.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.erreur = 'Erreur lors de la sauvegarde.';
        this.saving = false;
      }
    });
  }
}
