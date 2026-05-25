import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { PlanService } from '../../../core/services/plan.service';
import { StockService } from '../../../core/services/stock.service';
import { ReferentielService } from '../../../core/services/referentiel.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AnalyseResultat, AnalyseProduit, StructureAnalyse, LignePlan, PlanReattribution, Produit, Structure } from '../../../core/models/models';

@Component({
  selector: 'app-edition',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <!-- ── En-tête ──────────────────────────────────────────────────────────── -->
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <a mat-icon-button routerLink="/plans/suivi" matTooltip="Retour au suivi">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <h1 style="margin:0;">Édition du plan #{{ plan?.id }}</h1>
          <p style="margin:.1rem 0 0;" *ngIf="plan">
            {{ plan.periodeLibelle }} · {{ plan.programmeNom }} · {{ plan.regionNom }}
            <span [style.background]="statutBg(plan.statut)"
                  [style.color]="statutColor(plan.statut)"
                  style="margin-left:.5rem;font-size:.7rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;display:inline-block;">
              {{ plan.statut }}
            </span>
          </p>
        </div>
      </div>
      <!-- Actions header -->
      <div style="display:flex;gap:.5rem;" *ngIf="plan">
        <!-- Supprimer : BROUILLON (pharmacien+admin) ou validé (admin seul) -->
        <button mat-stroked-button color="warn"
          *ngIf="(plan.statut === 'BROUILLON' && (auth.isPharmacienRegion() || auth.isAdmin())) || (plan.statut !== 'BROUILLON' && auth.isAdmin())"
          (click)="supprimerPlan()"
          [disabled]="deletingPlan"
          matTooltip="Supprimer définitivement ce plan">
          <mat-spinner *ngIf="deletingPlan" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
          <mat-icon *ngIf="!deletingPlan">delete_outline</mat-icon>
          Supprimer
        </button>
        <!-- Valider : BROUILLON uniquement -->
        <button mat-raised-button color="primary"
          *ngIf="plan.statut === 'BROUILLON'"
          (click)="valider()"
          [disabled]="!plan.lignes?.length || validating"
          matTooltip="Valider et soumettre le plan">
          <mat-spinner *ngIf="validating" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!validating">check_circle</mat-icon>
          Valider le plan
        </button>
        <!-- Retour suivi : non-BROUILLON -->
        <a mat-stroked-button routerLink="/plans/suivi" *ngIf="plan.statut !== 'BROUILLON'">
          <mat-icon>list</mat-icon> Suivi des plans
        </a>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement du plan…</span>
    </div>

    <ng-container *ngIf="!loading && plan">

      <!-- Bannière statut plan validé -->
      <div *ngIf="plan.statut === 'VALIDE' || plan.statut === 'EN_COURS'"
           style="display:flex;align-items:center;gap:.875rem;padding:.875rem 1.25rem;background:rgba(79,70,229,.07);border:1px solid rgba(79,70,229,.25);border-radius:.5rem;margin-bottom:1.25rem;color:#4338ca;">
        <mat-icon style="color:#6366f1;">task_alt</mat-icon>
        <span>Plan <strong>validé</strong> — enregistrez les exécutions ligne par ligne.
          <ng-container *ngIf="auth.isSuperviseur() || auth.isAdmin()">
            Les superviseurs peuvent également supprimer les lignes non exécutées.
          </ng-container>
        </span>
        <span style="flex:1;"></span>
        <span style="font-size:.82rem;">{{ nbLignesExecutees }} / {{ dsLignes.data.length }} exécutées</span>
      </div>

      <!-- Bannière clôturé -->
      <div *ngIf="plan.statut === 'CLOTURE'"
           style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;background:rgba(107,114,128,.07);border:1px solid rgba(107,114,128,.25);border-radius:.5rem;margin-bottom:1.25rem;color:#374151;">
        <mat-icon style="color:#6b7280;">verified</mat-icon>
        <span>Plan <strong>clôturé</strong> — toutes les lignes ont été exécutées ou annulées.</span>
      </div>

      <!-- Résumé IA -->
      <mat-card *ngIf="plan.resumeIa" style="margin-bottom:1.25rem;background:rgba(79,70,229,.03) !important;">
        <mat-card-content style="display:flex;gap:.75rem;align-items:flex-start;padding:.875rem 1rem;">
          <mat-icon style="color:var(--accent-color);flex-shrink:0;">auto_awesome</mat-icon>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--accent-color);margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.04em;">Analyse IA</div>
            <p style="margin:0;font-size:.875rem;color:var(--text-secondary);line-height:1.6;">{{ plan.resumeIa }}</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Panneau d'édition d'une ligne (BROUILLON) ── -->
      <mat-card *ngIf="editingLigne" style="margin-bottom:1.25rem;border:2px solid rgba(99,102,241,.35);">
        <mat-card-header style="padding:.75rem 1rem .4rem;background:rgba(99,102,241,.05);">
          <mat-card-title style="font-size:.95rem;color:#4338ca;display:flex;align-items:center;gap:.5rem;">
            <mat-icon style="color:var(--accent-color);">edit</mat-icon>
            Modifier la ligne — {{ editingLigne.produitNom }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding:.875rem 1rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.875rem;">
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;">
              <div style="color:var(--text-secondary);font-size:.72rem;margin-bottom:.2rem;">SOURCE</div>
              <strong>{{ editingLigne.structureSourceNom }}</strong>
            </div>
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;">
              <div style="color:var(--text-secondary);font-size:.72rem;margin-bottom:.2rem;">DESTINATION</div>
              <strong style="color:#22c55e;">{{ editingLigne.structureCibleNom }}</strong>
            </div>
          </div>
          <div *ngIf="editForm.loadingStock" style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem;">
            <mat-spinner diameter="14"></mat-spinner> Chargement du stock disponible…
          </div>
          <div *ngIf="!editForm.loadingStock && editForm.stockNet !== null"
               style="display:flex;align-items:center;gap:.75rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid rgba(22,163,74,.3);border-radius:.375rem;font-size:.82rem;margin-bottom:.875rem;">
            <mat-icon style="color:#16a34a;font-size:16px;width:16px;height:16px;">inventory</mat-icon>
            Stock disponible net :
            <strong style="color:#15803d;font-family:monospace;">{{ editForm.stockNet | number:'1.0-0' }}</strong>
            <span style="color:var(--text-secondary);">(brut : {{ editForm.stockBrut | number:'1.0-0' }} − allocations : {{ (editForm.stockBrut! - editForm.stockNet!) | number:'1.0-0' }})</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Quantité</mat-label>
              <input matInput type="number" min="1" [(ngModel)]="editForm.quantite">
              <mat-hint *ngIf="editForm.stockNet !== null">Max : {{ editForm.stockNet | number:'1.0-0' }}</mat-hint>
            </mat-form-field>
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;display:flex;align-items:center;gap:.5rem;">
              <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--text-secondary);">event</mat-icon>
              Péremption FEFO :
              <strong style="font-family:monospace;">{{ editingLigne.expireDate ? (editingLigne.expireDate | date:'dd/MM/yyyy') : '—' }}</strong>
            </div>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.875rem;">
            <mat-label>Notes (optionnel)</mat-label>
            <textarea matInput [(ngModel)]="editForm.notes" rows="2"></textarea>
          </mat-form-field>
          <div *ngIf="editQuantiteDepasse" style="margin-bottom:.75rem;padding:.5rem .75rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.82rem;color:#b91c1c;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">block</mat-icon>
            Quantité supérieure au stock disponible net.
          </div>
          <div *ngIf="erreurEdition" style="margin-bottom:.75rem;padding:.5rem .875rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.85rem;color:#b91c1c;display:flex;gap:.5rem;align-items:center;">
            <mat-icon style="font-size:16px;width:16px;height:16px;">error_outline</mat-icon>{{ erreurEdition }}
          </div>
          <div style="display:flex;gap:.75rem;">
            <button mat-raised-button color="primary" (click)="saveEdit()" [disabled]="!peutSauvegarderEdit || editForm.saving">
              <mat-spinner *ngIf="editForm.saving" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
              <mat-icon *ngIf="!editForm.saving">save</mat-icon> Enregistrer
            </button>
            <button mat-stroked-button (click)="cancelEdit()">
              <mat-icon>close</mat-icon> Annuler
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Panneau d'exécution d'une ligne ── -->
      <mat-card *ngIf="executingLigne" style="margin-bottom:1.25rem;border:2px solid rgba(22,163,74,.35);">
        <mat-card-header style="padding:.75rem 1rem .4rem;background:rgba(22,163,74,.05);">
          <mat-card-title style="font-size:.95rem;color:#15803d;display:flex;align-items:center;gap:.5rem;">
            <mat-icon style="color:#22c55e;">play_circle</mat-icon>
            Enregistrer l'exécution — {{ executingLigne.produitNom }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding:.875rem 1rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.875rem;">
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;">
              <div style="color:var(--text-secondary);font-size:.72rem;margin-bottom:.2rem;">SOURCE</div>
              <strong>{{ executingLigne.structureSourceNom }}</strong>
            </div>
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;">
              <div style="color:var(--text-secondary);font-size:.72rem;margin-bottom:.2rem;">DESTINATION</div>
              <strong style="color:#22c55e;">{{ executingLigne.structureCibleNom }}</strong>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem;">
            <div style="padding:.5rem .75rem;background:#f0fdf4;border:1px solid rgba(22,163,74,.2);border-radius:.375rem;font-size:.82rem;">
              <div style="color:var(--text-secondary);font-size:.72rem;margin-bottom:.2rem;">QUANTITÉ PROPOSÉE</div>
              <strong style="font-family:monospace;font-size:1rem;">{{ executingLigne.quantiteProposee | number:'1.0-0' }}</strong>
              <span style="color:var(--text-secondary);"> {{ executingLigne.produitUnite }}</span>
            </div>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Quantité exécutée</mat-label>
              <input matInput type="number" min="0" [(ngModel)]="execQuantite">
              <mat-hint>Quantité réellement transférée</mat-hint>
            </mat-form-field>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.875rem;">
            <mat-label>Notes d'exécution (optionnel)</mat-label>
            <textarea matInput [(ngModel)]="execNotes" rows="2"></textarea>
          </mat-form-field>
          <div *ngIf="erreurExecution" style="margin-bottom:.75rem;padding:.5rem .875rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.85rem;color:#b91c1c;display:flex;gap:.5rem;align-items:center;">
            <mat-icon style="font-size:16px;width:16px;height:16px;">error_outline</mat-icon>{{ erreurExecution }}
          </div>
          <div style="display:flex;gap:.75rem;">
            <button mat-raised-button style="background:#16a34a;color:#fff;" (click)="saveExecution()"
              [disabled]="execQuantite === null || execQuantite === undefined || executingEnCours">
              <mat-spinner *ngIf="executingEnCours" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
              <mat-icon *ngIf="!executingEnCours">check_circle</mat-icon>
              Confirmer l'exécution
            </button>
            <button mat-stroked-button (click)="cancelExecute()">
              <mat-icon>close</mat-icon> Annuler
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Carte des mouvements ── -->
      <mat-card>
        <mat-card-header style="padding:.875rem 1rem .25rem;">
          <mat-card-title style="display:flex;align-items:center;justify-content:space-between;width:100%;font-size:.95rem;">
            <span>Mouvements du plan ({{ dsLignes.data.length }})</span>
            <!-- Bouton ajouter : BROUILLON uniquement -->
            <button mat-stroked-button color="primary"
              *ngIf="plan.statut === 'BROUILLON'"
              (click)="toggleAjout()" [class.active]="showAjout">
              <mat-icon>{{ showAjout ? 'close' : 'add' }}</mat-icon>
              {{ showAjout ? 'Annuler' : 'Ajouter une ligne' }}
            </button>
          </mat-card-title>
        </mat-card-header>

        <!-- Formulaire d'ajout (BROUILLON uniquement) -->
        <div *ngIf="showAjout && plan.statut === 'BROUILLON'"
             style="padding:1rem;border-bottom:1px solid var(--border-color);background:#f8fafc;">

          <!-- Chargement analyse contextuelle -->
          <div *ngIf="loadingAnalyse" style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text-secondary);margin-bottom:.75rem;">
            <mat-spinner diameter="14"></mat-spinner> Chargement de l'analyse des stocks…
          </div>

          <!-- Aucun produit en tension -->
          <div *ngIf="!loadingAnalyse && produitsEnTension.length === 0"
               style="padding:.75rem 1rem;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:.375rem;font-size:.85rem;color:#92400e;margin-bottom:.75rem;">
            <mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle;">info</mat-icon>
            Aucun produit en tension ou rupture détecté — aucune ligne ne peut être ajoutée.
          </div>

          <!-- Formulaire pas à pas (calqué sur génération manuelle) -->
          <ng-container *ngIf="!loadingAnalyse && produitsEnTension.length > 0">

            <!-- Étape 1 — Produit -->
            <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">1. Produit en tension</div>
            <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
              <mat-label>Produit</mat-label>
              <mat-select [(ngModel)]="ajout.produitId" (ngModelChange)="onAjoutProduitChange()">
                <mat-option [value]="null">-- Sélectionner --</mat-option>
                <mat-option *ngFor="let p of produitsEnTension" [value]="p.produitId">
                  {{ p.produitNom }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <ng-container *ngIf="ajout.produitId">

              <!-- Étape 2 — Structure cible -->
              <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">2. Structure destinataire (en tension / rupture)</div>
              <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
                <mat-label>Structure cible</mat-label>
                <mat-select [(ngModel)]="ajout.cibleId">
                  <mat-option [value]="null">-- Sélectionner --</mat-option>
                  <mat-option *ngFor="let s of ciblesAjout" [value]="s.structureId">
                    <span [style.color]="s.statutStock === 'RUPTURE' ? '#dc2626' : '#d97706'">
                      {{ s.statutStock }}
                    </span> · {{ s.structureNom }}
                    <span style="color:var(--text-secondary);font-size:.78rem;"> (MSD : {{ s.msd | number:'1.1-1' }})</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Étape 3 — Structure source -->
              <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">3. Structure source (en surstock ou stock dormant)</div>
              <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
                <mat-label>Structure source</mat-label>
                <mat-select [(ngModel)]="ajout.sourceId" (ngModelChange)="onAjoutSourceChange()">
                  <mat-option [value]="null">-- Sélectionner --</mat-option>
                  <mat-option *ngFor="let s of sourcesAjout" [value]="s.structureId">
                    {{ s.structureNom }}
                    <span *ngIf="s.statutStock === 'STOCK_DORMANT'" style="color:#475569;font-size:.78rem;"> (Stock dormant — {{ s.excedent | number:'1.0-0' }} unités redistribuables)</span>
                    <span *ngIf="s.statutStock !== 'STOCK_DORMANT'" style="color:var(--text-secondary);font-size:.78rem;"> (MSD : {{ s.msd | number:'1.1-1' }} · excédent : {{ s.excedent | number:'1.0-0' }})</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Info stock disponible -->
              <div *ngIf="ajout.loadingStock" style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem;">
                <mat-spinner diameter="14"></mat-spinner> Chargement du stock disponible…
              </div>
              <div *ngIf="ajout.sourceId && !ajout.loadingStock && ajout.stockNet !== null"
                   style="display:flex;align-items:center;gap:.75rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid rgba(22,163,74,.3);border-radius:.375rem;font-size:.82rem;margin-bottom:.75rem;">
                <mat-icon style="color:#16a34a;font-size:16px;width:16px;height:16px;">inventory</mat-icon>
                Stock disponible net&nbsp;:
                <strong style="color:#15803d;font-family:monospace;">{{ ajout.stockNet | number:'1.0-0' }}</strong>
                <span style="color:var(--text-secondary);">(brut : {{ ajout.stockBrut | number:'1.0-0' }} − allocations : {{ (ajout.stockBrut! - ajout.stockNet!) | number:'1.0-0' }})</span>
              </div>

              <!-- Étape 4 — Quantité -->
              <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">4. Quantité à redistribuer</div>
              <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;" *ngIf="ajout.sourceId">
                <mat-label>Quantité</mat-label>
                <input matInput type="number" min="1" [(ngModel)]="ajout.quantite">
                <mat-error *ngIf="ajoutQuantiteDepasse">
                  Dépasse le stock disponible net ({{ ajout.stockNet | number:'1.0-0' }})
                </mat-error>
              </mat-form-field>

              <!-- Étape 5 — Date péremption FEFO -->
              <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">5. Date de péremption — lot FEFO (source)</div>
              <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .875rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.875rem;margin-bottom:.875rem;min-height:40px;">
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--text-secondary);">event</mat-icon>
                <span *ngIf="ajout.expireDate" style="font-family:monospace;">{{ ajout.expireDate | date:'dd/MM/yyyy' }}</span>
                <span *ngIf="!ajout.expireDate" style="color:var(--text-secondary);font-style:italic;">— alimentée automatiquement dès la source sélectionnée —</span>
              </div>

              <!-- Bouton ajouter -->
              <button mat-raised-button color="primary"
                (click)="ajouterLigne()"
                [disabled]="!peutAjouterLigne || ajout.enCours">
                <mat-spinner *ngIf="ajout.enCours" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
                <mat-icon *ngIf="!ajout.enCours">add</mat-icon>
                Ajouter cette ligne
              </button>

              <!-- Alerte quantité dépassée -->
              <div *ngIf="ajoutQuantiteDepasse" style="margin-top:.5rem;padding:.5rem .75rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.82rem;color:#b91c1c;">
                <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">block</mat-icon>
                Quantité supérieure au stock disponible net — ajout bloqué.
              </div>

            </ng-container><!-- fin ng-container produitId -->
          </ng-container><!-- fin ng-container produitsEnTension -->
        </div>

        <!-- Tableau des lignes -->
        <mat-card-content style="padding:0;">
          <div style="padding:.5rem 1rem;">
            <mat-form-field appearance="outline" style="width:100%;">
              <mat-label>Filtrer les lignes</mat-label>
              <input matInput #fLignes (input)="dsLignes.filter=fLignes.value.trim().toLowerCase(); dsLignes.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>
          <table mat-table [dataSource]="dsLignes" matSort style="width:100%;">

            <ng-container matColumnDef="produit">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
              <td mat-cell *matCellDef="let l">
                <div style="font-size:.875rem;font-weight:500;">{{ l.produitNom }}</div>
                <div style="color:var(--text-secondary);font-size:.75rem;">{{ l.produitUnite }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
              <td mat-cell *matCellDef="let l" style="font-size:.875rem;">{{ l.structureSourceNom }}</td>
            </ng-container>

            <ng-container matColumnDef="destination">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
              <td mat-cell *matCellDef="let l" style="font-size:.875rem;color:#16a34a;">{{ l.structureCibleNom }}</td>
            </ng-container>

            <ng-container matColumnDef="quantite">
              <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Qté proposée</th>
              <td mat-cell *matCellDef="let l" style="text-align:right;font-weight:700;font-family:monospace;">
                {{ l.quantiteProposee | number:'1.0-0' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="unite">
              <th mat-header-cell *matHeaderCellDef>Unité</th>
              <td mat-cell *matCellDef="let l" style="font-size:.82rem;color:var(--text-secondary);">{{ l.produitUnite }}</td>
            </ng-container>

            <ng-container matColumnDef="qtExec">
              <th mat-header-cell *matHeaderCellDef style="text-align:right;">Qté exécutée</th>
              <td mat-cell *matCellDef="let l" style="text-align:right;font-family:monospace;color:#16a34a;">
                {{ l.quantiteExecutee != null ? (l.quantiteExecutee | number:'1.0-0') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="expireDate">
              <th mat-header-cell *matHeaderCellDef>Péremption (FEFO)</th>
              <td mat-cell *matCellDef="let l" style="font-size:.82rem;color:var(--text-secondary);">
                {{ l.expireDate ? (l.expireDate | date:'dd/MM/yyyy') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="statut">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
              <td mat-cell *matCellDef="let l">
                <span [style.background]="ligneBg(l.statut)"
                      [style.color]="ligneColor(l.statut)"
                      style="font-size:.72rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;display:inline-block;white-space:nowrap;">
                  {{ l.statut }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let l" style="text-align:right;white-space:nowrap;">

                <!-- BROUILLON : modifier + supprimer -->
                <ng-container *ngIf="plan!.statut === 'BROUILLON'">
                  <button mat-icon-button color="primary" style="width:34px;height:34px;"
                    (click)="startEdit(l)"
                    [disabled]="!!editingLigne || !!executingLigne"
                    matTooltip="Modifier cette ligne">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" style="width:34px;height:34px;"
                    (click)="supprimerLigne(l)"
                    [disabled]="!!editingLigne || !!executingLigne"
                    matTooltip="Supprimer">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                  </button>
                </ng-container>

                <!-- VALIDE / EN_COURS : exécuter + supprimer (superviseur) -->
                <ng-container *ngIf="plan!.statut === 'VALIDE' || plan!.statut === 'EN_COURS'">
                  <button mat-icon-button style="color:#16a34a;width:34px;height:34px;"
                    *ngIf="l.statut !== 'EXECUTE' && l.statut !== 'ANNULE' && (auth.isPharmacienRegion() || auth.isSuperviseur())"
                    (click)="startExecute(l)"
                    [disabled]="!!executingLigne || !!editingLigne"
                    matTooltip="Enregistrer l'exécution">
                    <mat-icon style="font-size:20px;width:20px;height:20px;">play_circle</mat-icon>
                  </button>
                  <mat-icon *ngIf="l.statut === 'EXECUTE'"
                    style="color:#16a34a;font-size:20px;width:20px;height:20px;vertical-align:middle;margin-right:4px;">
                    check_circle
                  </mat-icon>
                  <!-- Supprimer réservé au superviseur/admin -->
                  <button mat-icon-button color="warn" style="width:34px;height:34px;"
                    *ngIf="l.statut !== 'EXECUTE' && (auth.isSuperviseur() || auth.isAdmin())"
                    (click)="supprimerLigne(l)"
                    [disabled]="!!executingLigne || !!editingLigne"
                    matTooltip="Supprimer (superviseur)">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                  </button>
                </ng-container>

              </td>
            </ng-container>

            <!-- Jeu de colonnes selon statut plan -->
            <ng-container *ngIf="plan!.statut === 'BROUILLON'">
              <tr mat-header-row *matHeaderRowDef="colsBrouillon"></tr>
              <tr mat-row *matRowDef="let row; columns: colsBrouillon;"
                  [style.background]="editingLigne?.id === row.id ? 'rgba(99,102,241,.06)' : ''"></tr>
            </ng-container>
            <ng-container *ngIf="plan!.statut !== 'BROUILLON'">
              <tr mat-header-row *matHeaderRowDef="colsValide"></tr>
              <tr mat-row *matRowDef="let row; columns: colsValide;"
                  [style.background]="row.statut === 'EXECUTE' ? 'rgba(22,163,74,.04)' : ''"></tr>
            </ng-container>

            <tr class="mat-row" *matNoDataRow>
              <td colspan="8" style="text-align:center;padding:2.5rem;color:var(--text-secondary);">
                <mat-icon style="display:block;margin:0 auto .75rem;font-size:2rem;width:2rem;height:2rem;">playlist_add</mat-icon>
                Aucune ligne
              </td>
            </tr>
          </table>
          <mat-paginator [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
        </mat-card-content>
      </mat-card>

      <!-- Erreur globale -->
      <div *ngIf="error"
           style="display:flex;align-items:center;gap:.5rem;padding:.875rem 1rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;color:#b91c1c;font-size:.875rem;margin-top:1rem;">
        <mat-icon style="color:#dc2626;font-size:18px;width:18px;height:18px;">warning</mat-icon>
        {{ error }}
      </div>

    </ng-container>
  `
})
export class EditionComponent implements OnInit, AfterViewInit {

  plan: PlanReattribution | null = null;
  produits: Produit[] = [];
  structures: Structure[] = [];
  dsLignes = new MatTableDataSource<LignePlan>([]);
  loading = true;
  validating = false;
  deletingPlan = false;
  error = '';
  showAjout = false;

  // Analyse contextuelle pour le formulaire d'ajout
  analyse: AnalyseResultat | null = null;
  produitsEnTension: AnalyseProduit[] = [];
  loadingAnalyse = false;

  ajout: {
    produitId: number | null; cibleId: number | null; sourceId: number | null;
    quantite: number | null; expireDate: string | null;
    stockNet: number | null; stockBrut: number | null;
    loadingStock: boolean; enCours: boolean;
  } = this.ajoutVide();

  readonly colsBrouillon = ['produit', 'source', 'destination', 'quantite', 'unite', 'expireDate', 'statut', 'action'];
  readonly colsValide    = ['produit', 'source', 'destination', 'quantite', 'qtExec', 'unite', 'expireDate', 'statut', 'action'];

  // Édition inline (BROUILLON)
  editingLigne: LignePlan | null = null;
  editForm: {
    quantite: number | null;
    notes: string;
    stockNet: number | null;
    stockBrut: number | null;
    loadingStock: boolean;
    saving: boolean;
  } = this.editFormVide();
  erreurEdition = '';

  // Exécution ligne (VALIDE)
  executingLigne: LignePlan | null = null;
  execQuantite: number | null = null;
  execNotes = '';
  executingEnCours = false;
  erreurExecution = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private snackBar = inject(MatSnackBar);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planService: PlanService,
    private stockService: StockService,
    private refService: ReferentielService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.params['id'];
    this.planService.getPlan(id).subscribe({
      next: p => {
        this.plan = p;
        this.dsLignes.data = p.lignes ?? [];
        this.loading = false;
        this.refService.getProduits(p.programmeId ?? undefined).subscribe(prods => this.produits = prods);
        // Charger l'analyse contextuelle pour le formulaire d'ajout
        if (p.periodeId && p.programmeId && p.regionId) {
          this.loadingAnalyse = true;
          this.stockService.analyser(p.periodeId, p.programmeId, p.regionId).subscribe({
            next: a => {
              this.analyse = a;
              this.produitsEnTension = (a.produits ?? []).filter(
                prod => (prod.structuresEnRupture?.length ?? 0) + (prod.structuresEnTension?.length ?? 0) > 0
              );
              this.loadingAnalyse = false;
            },
            error: () => this.loadingAnalyse = false
          });
        }
      },
      error: () => this.loading = false
    });
    this.refService.getStructures().subscribe(s => this.structures = s);
  }

  ngAfterViewInit(): void {
    this.dsLignes.paginator = this.paginator;
    this.dsLignes.sort = this.sort;
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  get nbLignesExecutees(): number {
    return this.plan?.lignes?.filter(l => l.statut === 'EXECUTE').length ?? 0;
  }

  get editQuantiteDepasse(): boolean {
    return this.editForm.quantite !== null && this.editForm.stockNet !== null
        && this.editForm.quantite > this.editForm.stockNet;
  }

  get peutSauvegarderEdit(): boolean {
    return this.editForm.quantite !== null && this.editForm.quantite > 0
        && !this.editQuantiteDepasse && !this.editForm.loadingStock && !this.editForm.saving;
  }

  get ciblesAjout(): StructureAnalyse[] {
    const p = this.produitsEnTension.find(p => p.produitId === this.ajout.produitId);
    return p ? [...(p.structuresEnRupture ?? []), ...(p.structuresEnTension ?? [])] : [];
  }

  get sourcesAjout(): StructureAnalyse[] {
    const p = this.produitsEnTension.find(p => p.produitId === this.ajout.produitId);
    return p ? (p.structuresEnSurstock ?? []) : [];
  }

  get ajoutQuantiteDepasse(): boolean {
    return this.ajout.quantite !== null && this.ajout.stockNet !== null
        && this.ajout.quantite > this.ajout.stockNet;
  }

  get peutAjouterLigne(): boolean {
    return !!this.ajout.produitId && !!this.ajout.cibleId && !!this.ajout.sourceId
        && this.ajout.quantite !== null && this.ajout.quantite > 0
        && !this.ajoutQuantiteDepasse && !this.ajout.loadingStock;
  }

  // ── Statut chips ─────────────────────────────────────────────────────────────

  statutColor(statut: string): string {
    switch (statut) {
      case 'VALIDE':   return '#4338ca';
      case 'EN_COURS': return '#0369a1';
      case 'CLOTURE':  return '#374151';
      default:         return '#92400e'; // BROUILLON
    }
  }

  statutBg(statut: string): string {
    switch (statut) {
      case 'VALIDE':   return 'rgba(99,102,241,.12)';
      case 'EN_COURS': return 'rgba(3,105,161,.1)';
      case 'CLOTURE':  return 'rgba(107,114,128,.12)';
      default:         return 'rgba(217,119,6,.12)';
    }
  }

  ligneColor(statut: string): string {
    switch (statut) {
      case 'EXECUTE':  return '#15803d';
      case 'PARTIEL':  return '#92400e';
      case 'ANNULE':   return '#b91c1c';
      default:         return '#4338ca';
    }
  }

  ligneBg(statut: string): string {
    switch (statut) {
      case 'EXECUTE':  return 'rgba(22,163,74,.12)';
      case 'PARTIEL':  return 'rgba(217,119,6,.12)';
      case 'ANNULE':   return 'rgba(220,38,38,.1)';
      default:         return 'rgba(99,102,241,.1)';
    }
  }

  // ── Formulaire d'ajout ───────────────────────────────────────────────────────

  toggleAjout(): void {
    this.showAjout = !this.showAjout;
    this.ajout = this.ajoutVide();
  }

  onAjoutProduitChange(): void {
    this.ajout.cibleId    = null;
    this.ajout.sourceId   = null;
    this.ajout.quantite   = null;
    this.ajout.expireDate = null;
    this.ajout.stockNet   = null;
    this.ajout.stockBrut  = null;
  }

  onAjoutSourceChange(): void {
    this.ajout.quantite   = null;
    this.ajout.expireDate = null;
    this.ajout.stockNet   = null;
    this.ajout.stockBrut  = null;
    if (!this.ajout.produitId || !this.ajout.sourceId || !this.plan) return;
    this.ajout.loadingStock = true;
    this.planService.getStockSource(
      this.plan.periodeId, this.ajout.produitId, this.ajout.sourceId, this.plan.id
    ).subscribe({
      next: info => {
        this.ajout.expireDate   = info.expireDateFefo;
        this.ajout.stockNet     = info.stockNet;
        this.ajout.stockBrut    = info.stockBrut;
        this.ajout.loadingStock = false;
      },
      error: () => { this.ajout.loadingStock = false; }
    });
  }

  ajouterLigne(): void {
    if (!this.peutAjouterLigne || !this.plan) return;
    this.ajout.enCours = true;
    this.planService.ajouterLigne(this.plan.id, {
      produitId:         this.ajout.produitId,
      structureSourceId: this.ajout.sourceId,
      structureCibleId:  this.ajout.cibleId,
      quantiteProposee:  this.ajout.quantite,
      expireDate:        this.ajout.expireDate
    } as Partial<LignePlan>).subscribe({
      next: ligne => {
        this.plan!.lignes = [...(this.plan!.lignes ?? []), ligne];
        this.dsLignes.data = this.plan!.lignes;
        this.ajout = this.ajoutVide();
        this.snackBar.open('Ligne ajoutée.', 'OK', { duration: 2000 });
      },
      error: err => {
        this.error = err.error?.message || "Erreur lors de l'ajout.";
        this.ajout.enCours = false;
      }
    });
  }

  // ── Édition inline d'une ligne (BROUILLON) ───────────────────────────────────

  startEdit(ligne: LignePlan): void {
    this.editingLigne = ligne;
    this.erreurEdition = '';
    this.editForm = {
      quantite: ligne.quantiteProposee,
      notes: ligne.notes ?? '',
      stockNet: null, stockBrut: null,
      loadingStock: true, saving: false
    };
    this.planService.getStockSource(
      this.plan!.periodeId, ligne.produitId, ligne.structureSourceId, this.plan!.id, ligne.id
    ).subscribe({
      next: info => {
        this.editForm.stockNet    = info.stockNet;
        this.editForm.stockBrut   = info.stockBrut;
        this.editForm.loadingStock = false;
      },
      error: () => { this.editForm.loadingStock = false; }
    });
  }

  cancelEdit(): void {
    this.editingLigne = null;
    this.editForm = this.editFormVide();
    this.erreurEdition = '';
  }

  saveEdit(): void {
    if (!this.peutSauvegarderEdit || !this.plan || !this.editingLigne) return;
    this.editForm.saving = true;
    this.erreurEdition = '';
    this.planService.modifierLigne(this.plan.id, this.editingLigne.id, {
      produitId:         this.editingLigne.produitId,
      structureSourceId: this.editingLigne.structureSourceId,
      structureCibleId:  this.editingLigne.structureCibleId,
      quantiteProposee:  this.editForm.quantite,
      notes:             this.editForm.notes || null
    } as any).subscribe({
      next: updated => {
        this.plan!.lignes = this.plan!.lignes.map(l => l.id === updated.id ? updated : l);
        this.dsLignes.data = this.plan!.lignes;
        this.editingLigne = null;
        this.editForm = this.editFormVide();
        this.snackBar.open('Ligne modifiée.', 'OK', { duration: 2000 });
      },
      error: err => {
        this.erreurEdition = err.error?.message || 'Erreur lors de la modification';
        this.editForm.saving = false;
      }
    });
  }

  // ── Exécution d'une ligne (VALIDE) ────────────────────────────────────────────

  startExecute(ligne: LignePlan): void {
    this.executingLigne  = ligne;
    this.execQuantite    = ligne.quantiteProposee;
    this.execNotes       = '';
    this.erreurExecution = '';
  }

  cancelExecute(): void {
    this.executingLigne  = null;
    this.execQuantite    = null;
    this.execNotes       = '';
    this.erreurExecution = '';
  }

  saveExecution(): void {
    if (!this.executingLigne || !this.plan || this.execQuantite == null) return;
    this.executingEnCours = true;
    this.erreurExecution  = '';
    this.planService.executerLigne(
      this.plan.id, this.executingLigne.id, this.execQuantite, this.execNotes || undefined
    ).subscribe({
      next: updated => {
        this.plan!.lignes = this.plan!.lignes.map(l => l.id === updated.id ? updated : l);
        this.dsLignes.data = this.plan!.lignes;
        this.executingLigne   = null;
        this.execQuantite     = null;
        this.executingEnCours = false;
        this.snackBar.open('Exécution enregistrée.', 'OK', { duration: 2500 });
        // Recharger le plan pour détecter clôture automatique
        this.planService.getPlan(this.plan!.id).subscribe(p => {
          this.plan = p;
          this.dsLignes.data = p.lignes ?? [];
          if (p.statut === 'CLOTURE') {
            this.snackBar.open('Toutes les lignes exécutées — plan clôturé.', 'OK', { duration: 4000 });
          }
        });
      },
      error: err => {
        this.erreurExecution  = err.error?.message || "Erreur lors de l'exécution";
        this.executingEnCours = false;
      }
    });
  }

  // ── Suppression ───────────────────────────────────────────────────────────────

  supprimerLigne(ligne: LignePlan): void {
    const plan = this.plan;
    if (!plan) return;
    const wasValide = plan.statut !== 'BROUILLON';
    this.planService.supprimerLigne(plan.id, ligne.id).subscribe({
      next: () => {
        plan.lignes = plan.lignes.filter(l => l.id !== ligne.id);
        this.dsLignes.data = plan.lignes;
        this.snackBar.open('Ligne supprimée.', 'OK', { duration: 2000 });
        if (wasValide) {
          this.planService.getPlan(plan.id).subscribe(updated => {
            this.plan = updated;
            this.dsLignes.data = updated.lignes ?? [];
            if (updated.statut === 'CLOTURE') {
              this.snackBar.open('Plan clôturé automatiquement.', 'OK', { duration: 4000 });
            }
          });
        }
      },
      error: err => { this.error = err.error?.message || 'Erreur lors de la suppression.'; }
    });
  }

  // ── Suppression du plan ───────────────────────────────────────────────────────

  supprimerPlan(): void {
    if (!this.plan) return;
    if (!confirm(`Supprimer définitivement le plan #${this.plan.id} (${this.plan.periodeLibelle} · ${this.plan.programmeNom}) ?`)) return;
    this.deletingPlan = true;
    this.planService.supprimerPlan(this.plan.id).subscribe({
      next: () => this.router.navigate(['/plans/suivi']),
      error: err => {
        this.error = err.error?.message || 'Erreur lors de la suppression.';
        this.deletingPlan = false;
      }
    });
  }

  // ── Validation globale ────────────────────────────────────────────────────────

  valider(): void {
    if (!this.plan) return;
    this.validating = true;
    this.planService.valider(this.plan.id).subscribe({
      next: updated => {
        // Rester sur la page pour permettre l'exécution ligne par ligne
        this.plan = updated;
        this.dsLignes.data = updated.lignes ?? [];
        this.validating = false;
        this.snackBar.open(
          'Plan validé — enregistrez les exécutions ligne par ligne.',
          'OK', { duration: 4000 }
        );
      },
      error: err => {
        this.error = err.error?.message || 'Erreur lors de la validation.';
        this.validating = false;
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private ajoutVide() {
    return { produitId: null, cibleId: null, sourceId: null, quantite: null,
             expireDate: null, stockNet: null, stockBrut: null,
             loadingStock: false, enCours: false };
  }

  private editFormVide() {
    return { quantite: null, notes: '', stockNet: null, stockBrut: null,
             loadingStock: false, saving: false };
  }
}
