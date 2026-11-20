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
import { AnalysesService, Baremes } from '../../core/services/analyses.service';

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatSelectModule, MatTooltipModule
  ],
  styles: [`
    .bareme-groupe { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em;
                     color:var(--text-secondary); margin:.25rem 0 .4rem; }
    .bareme-grille { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:.75rem; }
  `],
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


          <ng-container *ngIf="parametre !== null">
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

        <mat-card-actions align="end" style="padding:1rem 1.5rem;" *ngIf="parametre !== null">
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

      <!-- Barèmes de lecture des synthèses (admin) -->
      <mat-card *ngIf="auth.isAdmin() && editBaremes" style="margin-top:1.5rem;">
        <mat-card-header>
          <mat-card-title>
            <mat-icon style="vertical-align:middle; margin-right:.5rem;">insights</mat-icon>
            Barèmes des synthèses
          </mat-card-title>
          <mat-card-subtitle>
            Communs à toutes les régions. Ils fixent à partir de quand l'onglet « Synthèses » du tableau de bord
            juge un résultat bon ou mauvais, et donc la lecture et les actions « À faire » qu'il propose.
            Ils ne changent aucune donnée ni aucun plan.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content style="padding-top:1.25rem;">
          <div class="bareme-groupe">Dispersion des MSD : resserrement de l'écart entre sites</div>
          <div class="bareme-grille">
            <mat-form-field appearance="fill">
              <mat-label>Équilibrage net à partir de</mat-label>
              <input matInput type="number" min="1" max="100" step="1" [(ngModel)]="editBaremes.equilibrageNetPct" [disabled]="savingBaremes">
              <span matTextSuffix>%</span>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Équilibrage modéré à partir de</mat-label>
              <input matInput type="number" min="0" max="100" step="1" [(ngModel)]="editBaremes.equilibrageModerePct" [disabled]="savingBaremes">
              <span matTextSuffix>%</span>
            </mat-form-field>
          </div>

          <div class="bareme-groupe">Carte sites × produits et alerte précoce</div>
          <div class="bareme-grille">
            <mat-form-field appearance="fill" matTooltip="Un site est dit fragile si au moins cette part de ses produits reste en tension ou en rupture après le plan">
              <mat-label>Site fragile à partir de</mat-label>
              <input matInput type="number" min="1" max="100" step="5" [(ngModel)]="editBaremes.fragilitePct" [disabled]="savingBaremes">
              <span matTextSuffix>% de produits</span>
            </mat-form-field>
            <mat-form-field appearance="fill" matTooltip="Ruptures attendues dans ce délai à compter d'aujourd'hui">
              <mat-label>Horizon d'alerte</mat-label>
              <input matInput type="number" min="1" max="365" step="1" [(ngModel)]="editBaremes.alerteHorizonJours" [disabled]="savingBaremes">
              <span matTextSuffix>jours</span>
            </mat-form-field>
          </div>

          <div class="bareme-groupe">Ruptures et surstocks chroniques</div>
          <div class="bareme-grille">
            <mat-form-field appearance="fill">
              <mat-label>Périodes examinées</mat-label>
              <input matInput type="number" min="2" max="24" step="1" [(ngModel)]="editBaremes.chroniqueFenetre" [disabled]="savingBaremes">
              <span matTextSuffix>périodes</span>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Chronique à partir de</mat-label>
              <input matInput type="number" min="1" max="24" step="1" [(ngModel)]="editBaremes.chroniqueOccurrences" [disabled]="savingBaremes">
              <span matTextSuffix>fois</span>
            </mat-form-field>
          </div>

          <div class="bareme-groupe">Fiabilité de l'exécution par site source</div>
          <div class="bareme-grille">
            <mat-form-field appearance="fill">
              <mat-label>Fiabilité bonne à partir de</mat-label>
              <input matInput type="number" min="1" max="100" step="5" [(ngModel)]="editBaremes.fiabiliteBonnePct" [disabled]="savingBaremes">
              <span matTextSuffix>% livré</span>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Fiabilité faible en dessous de</mat-label>
              <input matInput type="number" min="0" max="100" step="5" [(ngModel)]="editBaremes.fiabiliteFaiblePct" [disabled]="savingBaremes">
              <span matTextSuffix>% livré</span>
            </mat-form-field>
            <mat-form-field appearance="fill" matTooltip="Un mouvement non exécuté passé ce délai après la validation du plan est compté en retard">
              <mat-label>Retard au-delà de</mat-label>
              <input matInput type="number" min="1" max="365" step="1" [(ngModel)]="editBaremes.retardJours" [disabled]="savingBaremes">
              <span matTextSuffix>jours</span>
            </mat-form-field>
          </div>

          <div *ngIf="erreurBaremesLocale" style="margin-top:.25rem;color:#dc2626;font-size:.85rem;">{{ erreurBaremesLocale }}</div>
          <div *ngIf="erreurBaremes" style="margin-top:.25rem;color:#dc2626;font-size:.85rem;">{{ erreurBaremes }}</div>
        </mat-card-content>
        <mat-card-actions align="end" style="padding:1rem 1.5rem;">
          <button mat-stroked-button (click)="annulerBaremes()" [disabled]="savingBaremes">Annuler</button>
          <button mat-flat-button color="primary" (click)="sauvegarderBaremes()"
                  [disabled]="savingBaremes || !!erreurBaremesLocale" style="margin-left:.75rem;">
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

  // Barèmes des synthèses (admin)
  private analysesService = inject(AnalysesService);
  private baremesEnregistres: Baremes | null = null;
  editBaremes: Baremes | null = null;
  savingBaremes = false;
  erreurBaremes = '';

  /** Même contrôle que le serveur, pour guider la saisie. */
  get erreurBaremesLocale(): string {
    const b = this.editBaremes;
    if (!b) return '';
    const n = (v: number) => v === null || v === undefined || isNaN(v);
    if (Object.values(b).some(v => n(v as number))) return 'Tous les barèmes doivent être renseignés.';
    if (b.equilibrageModerePct < 0 || b.equilibrageModerePct >= b.equilibrageNetPct || b.equilibrageNetPct > 100)
      return 'Équilibrage : 0 ≤ seuil « modéré » < seuil « net » ≤ 100 %.';
    if (b.alerteHorizonJours < 1 || b.alerteHorizonJours > 365) return 'Horizon d\'alerte : entre 1 et 365 jours.';
    if (b.chroniqueFenetre < 2 || b.chroniqueFenetre > 24 || b.chroniqueOccurrences < 1 || b.chroniqueOccurrences > b.chroniqueFenetre)
      return 'Chronicité : 2 à 24 périodes examinées, et un nombre de fois entre 1 et ce nombre de périodes.';
    if (b.fiabiliteFaiblePct < 0 || b.fiabiliteFaiblePct >= b.fiabiliteBonnePct || b.fiabiliteBonnePct > 100)
      return 'Fiabilité : 0 ≤ seuil « faible » < seuil « bonne » ≤ 100 %.';
    if (b.retardJours < 1 || b.retardJours > 365) return 'Retard : entre 1 et 365 jours.';
    if (b.fragilitePct <= 0 || b.fragilitePct > 100) return 'Site fragile : entre 1 et 100 %.';
    return '';
  }

  chargerBaremes(): void {
    this.analysesService.baremes().subscribe(b => { this.baremesEnregistres = b; this.editBaremes = { ...b }; });
  }

  annulerBaremes(): void {
    if (this.baremesEnregistres) this.editBaremes = { ...this.baremesEnregistres };
    this.erreurBaremes = '';
  }

  sauvegarderBaremes(): void {
    if (!this.editBaremes || this.erreurBaremesLocale) return;
    this.savingBaremes = true;
    this.erreurBaremes = '';
    this.analysesService.modifierBaremes(this.editBaremes).subscribe({
      next: b => {
        this.baremesEnregistres = b;
        this.editBaremes = { ...b };
        this.savingBaremes = false;
        this.snackBar.open('Barèmes des synthèses enregistrés.', 'OK', { duration: 3000 });
      },
      error: err => {
        this.erreurBaremes = err.error?.message || 'Erreur lors de la sauvegarde.';
        this.savingBaremes = false;
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
      this.chargerBaremes();
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
