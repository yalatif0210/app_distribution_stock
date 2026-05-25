import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import {
  AnalyseResultat, AnalyseProduit, StructureAnalyse,
  Programme, PeriodeSaisie, PlanReattribution, LignePlan
} from '../../../core/models/models';

@Component({
  selector: 'app-generation',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <!-- ──────────────────────────────── HEADER ──────────────────────────────── -->
    <div class="page-header">
      <h1>Générer un plan de réattribution</h1>
      <p>Analysez les stocks et générez un plan de redistribution</p>
    </div>

    <!-- ─────────────────────────── PARAMÈTRES ───────────────────────────────── -->
    <mat-card style="margin-bottom:1.25rem;" *ngIf="!plan">
      <mat-card-header style="padding:1rem 1rem .5rem;">
        <mat-card-title style="font-size:1rem;">Paramètres d'analyse</mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding-top:.5rem;">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
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
            <mat-label>Programme</mat-label>
            <mat-select [(ngModel)]="programmeId">
              <mat-option [value]="null">Tous les programmes</mat-option>
              <mat-option *ngFor="let p of programmes" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.8rem;color:var(--text-secondary);margin-bottom:.75rem;">
          <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;color:var(--accent-color);">place</mat-icon>
          Région : <strong style="color:var(--text-primary);">{{ regionNom }}</strong>
        </div>
        <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
          <mat-label>Notes (optionnel)</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="2"></textarea>
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="generer()" [disabled]="!periodeId || !regionId || loading">
          <mat-spinner *ngIf="loading" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          <mat-icon *ngIf="!loading">bolt</mat-icon>
          Analyser et générer
        </button>
        <div *ngIf="error" style="margin-top:.75rem;padding:.75rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:.375rem;color:#b91c1c;font-size:.875rem;display:flex;gap:.5rem;align-items:center;">
          <mat-icon style="font-size:18px;width:18px;height:18px;">warning</mat-icon>{{ error }}
        </div>
      </mat-card-content>
    </mat-card>

    <!-- ══════════════════════ MODE IA (plan.genereParlA = true) ═════════════════ -->
    <ng-container *ngIf="plan && plan.genereParlA">

      <!-- Bandeau statut -->
      <div [style.background]="plan.statut === 'BROUILLON' ? 'rgba(22,163,74,.08)' : plan.statut === 'CLOTURE' ? 'rgba(107,114,128,.07)' : 'rgba(79,70,229,.08)'"
           [style.border-color]="plan.statut === 'BROUILLON' ? 'rgba(22,163,74,.3)' : plan.statut === 'CLOTURE' ? 'rgba(107,114,128,.3)' : 'rgba(79,70,229,.3)'"
           style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;border:1px solid;border-radius:.5rem;margin-bottom:1.25rem;">
        <mat-icon [style.color]="plan.statut === 'BROUILLON' ? '#22c55e' : plan.statut === 'CLOTURE' ? '#6b7280' : '#6366f1'">
          {{ plan.statut === 'BROUILLON' ? 'check_circle' : plan.statut === 'CLOTURE' ? 'verified' : 'task_alt' }}
        </mat-icon>
        <span [style.color]="plan.statut === 'BROUILLON' ? '#15803d' : plan.statut === 'CLOTURE' ? '#374151' : '#4338ca'">
          Plan généré automatiquement — IA (ID&nbsp;:&nbsp;{{ plan.id }})
          <span *ngIf="plan.statut === 'BROUILLON'"> · Révision des mouvements</span>
          <strong *ngIf="plan.statut === 'VALIDE'"> · Validé — enregistrez les exécutions ligne par ligne</strong>
          <strong *ngIf="plan.statut === 'CLOTURE'"> · Clôturé</strong>
        </span>
        <span style="background:rgba(79,70,229,.12);color:var(--accent-color);font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:.25rem;">IA</span>
        <span style="flex:1;"></span>
        <a mat-stroked-button routerLink="/plans/suivi" style="font-size:.75rem;" *ngIf="plan.statut !== 'BROUILLON'">
          <mat-icon style="font-size:16px;width:16px;height:16px;">list</mat-icon> Suivi des plans
        </a>
        <button mat-stroked-button (click)="reinitialiser()" style="font-size:.75rem;" *ngIf="plan.statut === 'BROUILLON'">
          <mat-icon style="font-size:16px;width:16px;height:16px;">refresh</mat-icon> Nouveau plan
        </button>
      </div>

      <!-- Résumé IA -->
      <mat-card *ngIf="plan.resumeIa" style="margin-bottom:1.25rem;background:rgba(79,70,229,.03) !important;">
        <mat-card-content style="display:flex;gap:.75rem;align-items:flex-start;padding:.875rem 1rem;">
          <mat-icon style="color:var(--accent-color);flex-shrink:0;">auto_awesome</mat-icon>
          <div>
            <div style="font-size:.78rem;font-weight:700;color:var(--accent-color);margin-bottom:.2rem;text-transform:uppercase;letter-spacing:.04em;">Analyse IA</div>
            <p style="margin:0;font-size:.875rem;color:var(--text-secondary);line-height:1.6;">{{ plan.resumeIa }}</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Panneau d'édition d'une ligne ── -->
      <mat-card *ngIf="editingLigne" style="margin-bottom:1.25rem;border:2px solid rgba(99,102,241,.35);">
        <mat-card-header style="padding:.75rem 1rem .4rem;background:rgba(99,102,241,.05);">
          <mat-card-title style="font-size:.95rem;color:#4338ca;display:flex;align-items:center;gap:.5rem;">
            <mat-icon style="color:var(--accent-color);">edit</mat-icon>
            Modifier la ligne — {{ editingLigne.produitNom }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding:.875rem 1rem;">

          <!-- Contexte lecture seule -->
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

          <!-- Stock disponible net -->
          <div *ngIf="editForm.loadingStock" style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem;">
            <mat-spinner diameter="14"></mat-spinner> Chargement du stock disponible…
          </div>
          <div *ngIf="!editForm.loadingStock && editForm.stockNet !== null"
               style="display:flex;align-items:center;gap:.75rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid rgba(22,163,74,.3);border-radius:.375rem;font-size:.82rem;margin-bottom:.875rem;">
            <mat-icon style="color:#16a34a;font-size:16px;width:16px;height:16px;">inventory</mat-icon>
            Stock disponible net&nbsp;:
            <strong style="color:#15803d;font-family:monospace;">{{ editForm.stockNet | number:'1.0-0' }}</strong>
            <span style="color:var(--text-secondary);">(brut : {{ editForm.stockBrut | number:'1.0-0' }} − allocations : {{ (editForm.stockBrut! - editForm.stockNet!) | number:'1.0-0' }})</span>
          </div>

          <!-- Quantité -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Quantité</mat-label>
              <input matInput type="number" min="1" [(ngModel)]="editForm.quantite">
              <mat-hint *ngIf="editForm.stockNet !== null">Max : {{ editForm.stockNet | number:'1.0-0' }}</mat-hint>
              <mat-error *ngIf="editQuantiteDepasse">Dépasse le stock net</mat-error>
            </mat-form-field>
            <div style="padding:.5rem .75rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.82rem;display:flex;align-items:center;gap:.5rem;">
              <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--text-secondary);">event</mat-icon>
              <span>Péremption FEFO : </span>
              <strong style="font-family:monospace;">{{ editingLigne.expireDate ? (editingLigne.expireDate | date:'dd/MM/yyyy') : '—' }}</strong>
            </div>
          </div>

          <!-- Notes -->
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.875rem;">
            <mat-label>Notes (optionnel)</mat-label>
            <textarea matInput [(ngModel)]="editForm.notes" rows="2"></textarea>
          </mat-form-field>

          <!-- Alerte dépassement -->
          <div *ngIf="editQuantiteDepasse" style="margin-bottom:.75rem;padding:.5rem .75rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.82rem;color:#b91c1c;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">block</mat-icon>
            Quantité supérieure au stock disponible net — modification bloquée.
          </div>

          <!-- Erreur -->
          <div *ngIf="erreurEdition" style="margin-bottom:.75rem;padding:.5rem .875rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.85rem;color:#b91c1c;display:flex;gap:.5rem;align-items:center;">
            <mat-icon style="font-size:16px;width:16px;height:16px;">error_outline</mat-icon>{{ erreurEdition }}
          </div>

          <div style="display:flex;gap:.75rem;">
            <button mat-raised-button color="primary" (click)="saveEdit()"
              [disabled]="!peutSauvegarderEdit || editForm.saving">
              <mat-spinner *ngIf="editForm.saving" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
              <mat-icon *ngIf="!editForm.saving">save</mat-icon>
              Enregistrer
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

          <!-- Contexte lecture seule -->
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

          <!-- Erreur -->
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

      <!-- Tableau mouvements IA -->
      <mat-card>
        <mat-card-header style="padding:1rem 1rem .5rem;">
          <mat-card-title style="display:flex;align-items:center;justify-content:space-between;width:100%;font-size:1rem;">
            <span>
              Mouvements proposés ({{ dsLignes.data.length }})
              <span *ngIf="plan.statut === 'VALIDE'" style="margin-left:.5rem;font-size:.78rem;color:var(--text-secondary);">
                · {{ nbLignesExecutees }} / {{ dsLignes.data.length }} exécutées
              </span>
            </span>
            <div style="display:flex;gap:.5rem;">
              <a mat-stroked-button [routerLink]="['/plans', plan.id, 'edition']"
                 *ngIf="plan.statut === 'BROUILLON'" style="font-size:.82rem;">
                <mat-icon>open_in_new</mat-icon> Éditeur complet
              </a>
              <button mat-raised-button color="primary"
                *ngIf="plan.statut === 'BROUILLON'"
                (click)="valider()" [disabled]="validating || !plan.lignes?.length">
                <mat-spinner *ngIf="validating" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
                <mat-icon *ngIf="!validating">task_alt</mat-icon> Valider le plan
              </button>
            </div>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding:0;">
          <table mat-table [dataSource]="dsLignes" matSort style="width:100%;">

            <ng-container matColumnDef="produit">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
              <td mat-cell *matCellDef="let l">
                <div style="font-weight:500;">{{ l.produitNom }}</div>
                <div style="color:var(--text-secondary);font-size:.75rem;">{{ l.produitUnite }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
              <td mat-cell *matCellDef="let l" style="font-size:.875rem;">{{ l.structureSourceNom }}</td>
            </ng-container>

            <ng-container matColumnDef="destination">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
              <td mat-cell *matCellDef="let l" style="font-size:.875rem;color:#22c55e;">{{ l.structureCibleNom }}</td>
            </ng-container>

            <ng-container matColumnDef="quantite">
              <th mat-header-cell *matHeaderCellDef style="text-align:right;">Qté proposée</th>
              <td mat-cell *matCellDef="let l" style="text-align:right;font-weight:600;font-family:monospace;">
                {{ l.quantiteProposee | number:'1.0-0' }}
              </td>
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
              <th mat-header-cell *matHeaderCellDef>Statut</th>
              <td mat-cell *matCellDef="let l">
                <span [style.background]="statutBg(l.statut)"
                      [style.color]="statutColor(l.statut)"
                      style="font-size:.72rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;display:inline-block;white-space:nowrap;">
                  {{ l.statut }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actionsIA">
              <th mat-header-cell *matHeaderCellDef style="text-align:right;"></th>
              <td mat-cell *matCellDef="let l" style="text-align:right;white-space:nowrap;">

                <!-- Actions BROUILLON : modifier + supprimer -->
                <ng-container *ngIf="plan!.statut === 'BROUILLON'">
                  <button mat-icon-button color="primary"
                    (click)="startEdit(l)"
                    [disabled]="!!editingLigne || !!executingLigne"
                    matTooltip="Modifier cette ligne"
                    style="width:34px;height:34px;">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn"
                    (click)="supprimerLigne(l)"
                    [disabled]="!!editingLigne || !!executingLigne"
                    matTooltip="Supprimer"
                    style="width:34px;height:34px;">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                  </button>
                </ng-container>

                <!-- Actions VALIDE : exécuter + supprimer si pas encore exécuté -->
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
                  <span *ngIf="l.statut === 'PARTIEL'" style="font-size:.75rem;color:#d97706;">
                    <mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle;">timelapse</mat-icon>
                  </span>
                  <button mat-icon-button color="warn" style="width:34px;height:34px;"
                    *ngIf="l.statut !== 'EXECUTE' && (auth.isSuperviseur() || auth.isAdmin())"
                    (click)="supprimerLigne(l)"
                    [disabled]="!!executingLigne || !!editingLigne"
                    matTooltip="Supprimer cette ligne (superviseur)">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                  </button>
                </ng-container>

              </td>
            </ng-container>

            <!-- Colonnes selon statut plan -->
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
              <td colspan="7" style="text-align:center;color:var(--text-secondary);padding:2rem;">Aucun mouvement proposé</td>
            </tr>
          </table>
          <mat-paginator [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
        </mat-card-content>
      </mat-card>

      <!-- Message erreur global -->
      <div *ngIf="error" style="margin-top:.75rem;padding:.75rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:.375rem;color:#b91c1c;font-size:.875rem;display:flex;gap:.5rem;align-items:center;">
        <mat-icon style="font-size:18px;width:18px;height:18px;">warning</mat-icon>{{ error }}
      </div>

    </ng-container><!-- fin mode IA -->

    <!-- ══════════════════ MODE MANUEL (plan.genereParlA = false) ════════════════ -->
    <ng-container *ngIf="plan && !plan.genereParlA">

      <!-- Bandeau avertissement -->
      <div style="display:flex;align-items:flex-start;gap:.875rem;padding:1rem 1.25rem;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.35);border-radius:.5rem;margin-bottom:1.25rem;color:#92400e;">
        <mat-icon style="color:#d97706;flex-shrink:0;margin-top:.05rem;">warning_amber</mat-icon>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:.2rem;">Construction manuelle du plan</div>
          <div style="font-size:.82rem;line-height:1.5;">
            L'IA n'est pas disponible dans cet environnement. Construisez le plan ligne par ligne ci-dessous.
            Les produits en <strong>tension ou rupture</strong> apparaissent en cible ; les sites en <strong>surstock ou stock dormant</strong> apparaissent en source.
          </div>
        </div>
        <button mat-stroked-button (click)="reinitialiser()" style="font-size:.75rem;border-color:rgba(217,119,6,.4);color:#92400e;">
          <mat-icon style="font-size:16px;width:16px;height:16px;">refresh</mat-icon> Nouveau plan
        </button>
      </div>

      <!-- Cas multi-programme sans analyse disponible -->
      <mat-card *ngIf="!programmeId" style="margin-bottom:1.25rem;border:1px solid var(--border-color);">
        <mat-card-content style="padding:1.25rem;text-align:center;color:var(--text-secondary);">
          <mat-icon style="font-size:2.5rem;width:2.5rem;height:2.5rem;margin-bottom:.75rem;display:block;margin-inline:auto;color:#d97706;">info_outline</mat-icon>
          <div style="font-size:.9rem;margin-bottom:.75rem;">
            Le plan multi-programmes ne peut pas être filtré produit par produit depuis cette page.
          </div>
          <a mat-raised-button color="primary" [routerLink]="['/plans', plan.id, 'edition']">
            <mat-icon>edit</mat-icon> Saisir les lignes dans l'éditeur
          </a>
        </mat-card-content>
      </mat-card>

      <!-- Formulaire de saisie manuelle (programme sélectionné uniquement) -->
      <ng-container *ngIf="programmeId">

        <!-- Chargement analyse -->
        <div *ngIf="loadingAnalyse" style="display:flex;align-items:center;gap:.75rem;padding:1rem;color:var(--text-secondary);">
          <mat-spinner diameter="24"></mat-spinner> Chargement de l'analyse des stocks…
        </div>

        <ng-container *ngIf="!loadingAnalyse && analyse">

          <!-- Aucun produit en tension -->
          <mat-card *ngIf="produitsEnTension.length === 0" style="margin-bottom:1.25rem;text-align:center;padding:1.5rem;color:var(--text-secondary);">
            <mat-icon style="font-size:2.5rem;width:2.5rem;height:2.5rem;margin-bottom:.5rem;display:block;margin-inline:auto;">inventory_2</mat-icon>
            Aucun produit en tension ou rupture dans cette région pour ce programme.
          </mat-card>

          <!-- Formulaire d'ajout de ligne -->
          <mat-card *ngIf="produitsEnTension.length > 0" style="margin-bottom:1.25rem;border:2px solid rgba(217,119,6,.25);">
            <mat-card-header style="padding:.875rem 1rem .5rem;background:rgba(217,119,6,.05);">
              <mat-card-title style="font-size:.95rem;color:#92400e;display:flex;align-items:center;gap:.5rem;">
                <mat-icon style="color:#d97706;">add_circle_outline</mat-icon>
                Ajouter une ligne au plan
              </mat-card-title>
            </mat-card-header>
            <mat-card-content style="padding:.875rem 1rem;">

              <!-- Étape 1 — Produit -->
              <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">1. Produit en tension</div>
              <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
                <mat-label>Produit</mat-label>
                <mat-select [(ngModel)]="nvl.produitId" (ngModelChange)="onProduitChange()">
                  <mat-option [value]="null">-- Sélectionner --</mat-option>
                  <mat-option *ngFor="let p of produitsEnTension" [value]="p.produitId">
                    {{ p.produitNom }}
                    <span style="color:var(--text-secondary);font-size:.8rem;"> · {{ p.produitCode }}</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <ng-container *ngIf="nvl.produitId">

                <!-- Étape 2 — Structure cible -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">2. Structure destinataire (en tension / rupture)</div>
                <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
                  <mat-label>Structure cible</mat-label>
                  <mat-select [(ngModel)]="nvl.cibleId" (ngModelChange)="onCibleChange()">
                    <mat-option [value]="null">-- Sélectionner --</mat-option>
                    <mat-option *ngFor="let s of ciblesDisponibles" [value]="s.structureId">
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
                  <mat-select [(ngModel)]="nvl.sourceId" (ngModelChange)="onSourceChange()">
                    <mat-option [value]="null">-- Sélectionner --</mat-option>
                    <mat-option *ngFor="let s of sourcesDisponibles" [value]="s.structureId">
                      {{ s.structureNom }}
                      <span *ngIf="s.statutStock === 'STOCK_DORMANT'" style="color:#475569;font-size:.78rem;"> (Stock dormant — {{ s.excedent | number:'1.0-0' }} unités redistribuables)</span>
                      <span *ngIf="s.statutStock !== 'STOCK_DORMANT'" style="color:var(--text-secondary);font-size:.78rem;"> (MSD : {{ s.msd | number:'1.1-1' }} · excédent : {{ s.excedent | number:'1.0-0' }})</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <!-- Info stock disponible -->
                <div *ngIf="nvl.loadingStock" style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem;">
                  <mat-spinner diameter="14"></mat-spinner> Chargement du stock disponible…
                </div>
                <div *ngIf="nvl.sourceId && !nvl.loadingStock && nvl.stockNet !== null"
                     style="display:flex;align-items:center;gap:.75rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid rgba(22,163,74,.3);border-radius:.375rem;font-size:.82rem;margin-bottom:.75rem;">
                  <mat-icon style="color:#16a34a;font-size:16px;width:16px;height:16px;">inventory</mat-icon>
                  Stock disponible net&nbsp;:
                  <strong style="color:#15803d;font-family:monospace;">{{ nvl.stockNet | number:'1.0-0' }}</strong>
                  <span style="color:var(--text-secondary);">(brut : {{ nvl.stockBrut | number:'1.0-0' }} − allocations : {{ (nvl.stockBrut! - nvl.stockNet!) | number:'1.0-0' }})</span>
                </div>

                <!-- Étape 4 — Quantité -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">4. Quantité à redistribuer</div>
                <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;" *ngIf="nvl.sourceId">
                  <mat-label>Quantité</mat-label>
                  <input matInput type="number" min="1" [(ngModel)]="nvl.quantite">
                  <mat-error *ngIf="quantiteDepasse">
                    Dépasse le stock disponible net ({{ nvl.stockNet | number:'1.0-0' }})
                  </mat-error>
                </mat-form-field>

                <!-- Étape 5 — Date péremption (lecture seule FEFO) -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">5. Date de péremption — lot FEFO (source)</div>
                <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .875rem;background:#f8fafc;border:1px solid var(--border-color);border-radius:.375rem;font-size:.875rem;margin-bottom:.875rem;min-height:40px;">
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--text-secondary);">event</mat-icon>
                  <span *ngIf="nvl.expireDate" style="font-family:monospace;">{{ nvl.expireDate | date:'dd/MM/yyyy' }}</span>
                  <span *ngIf="!nvl.expireDate" style="color:var(--text-secondary);font-style:italic;">— alimentée automatiquement dès la source sélectionnée —</span>
                </div>

                <!-- Bouton ajouter -->
                <button mat-raised-button color="accent"
                  (click)="ajouterLigneManuel()"
                  [disabled]="!peutAjouter || nvl.ajoutEnCours"
                  style="background:#d97706;color:#fff;">
                  <mat-spinner *ngIf="nvl.ajoutEnCours" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
                  <mat-icon *ngIf="!nvl.ajoutEnCours">add</mat-icon>
                  Ajouter cette ligne
                </button>

                <!-- Alerte quantité -->
                <div *ngIf="quantiteDepasse" style="margin-top:.5rem;padding:.5rem .75rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.82rem;color:#b91c1c;">
                  <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">block</mat-icon>
                  Quantité supérieure au stock disponible net — ajout bloqué.
                </div>

              </ng-container><!-- fin ng-container produitId -->

              <!-- Erreur ajout -->
              <div *ngIf="erreurAjout" style="margin-top:.75rem;padding:.5rem .875rem;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:.375rem;font-size:.85rem;color:#b91c1c;display:flex;gap:.5rem;align-items:center;">
                <mat-icon style="font-size:16px;width:16px;height:16px;">error_outline</mat-icon>
                {{ erreurAjout }}
              </div>

            </mat-card-content>
          </mat-card><!-- fin formulaire -->

          <!-- Tableau des lignes saisies -->
          <mat-card>
            <mat-card-header style="padding:.875rem 1rem .25rem;background:rgba(217,119,6,.04);border-bottom:1px solid rgba(217,119,6,.15);">
              <mat-card-title style="display:flex;align-items:center;justify-content:space-between;width:100%;font-size:.95rem;color:#92400e;">
                <span>
                  <mat-icon style="color:#d97706;vertical-align:middle;margin-right:.25rem;">list_alt</mat-icon>
                  Mouvements saisis manuellement ({{ dsLignes.data.length }})
                </span>
                <button mat-raised-button (click)="valider()" [disabled]="validating || !plan.lignes?.length"
                  style="background:#d97706;color:#fff;">
                  <mat-spinner *ngIf="validating" diameter="16" style="display:inline-block;margin-right:.3rem;"></mat-spinner>
                  <mat-icon *ngIf="!validating">check_circle</mat-icon>
                  Valider le plan
                </button>
              </mat-card-title>
            </mat-card-header>
            <mat-card-content style="padding:0;">
              <table mat-table [dataSource]="dsLignes" matSort style="width:100%;">
                <ng-container matColumnDef="produit">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                  <td mat-cell *matCellDef="let l"><div style="font-weight:500;font-size:.875rem;">{{ l.produitNom }}</div><div style="color:var(--text-secondary);font-size:.75rem;">{{ l.produitUnite }}</div></td>
                </ng-container>
                <ng-container matColumnDef="source">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.875rem;">{{ l.structureSourceNom }}</td>
                </ng-container>
                <ng-container matColumnDef="destination">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.875rem;color:#d97706;">{{ l.structureCibleNom }}</td>
                </ng-container>
                <ng-container matColumnDef="quantite">
                  <th mat-header-cell *matHeaderCellDef style="text-align:right;">Quantité</th>
                  <td mat-cell *matCellDef="let l" style="text-align:right;font-weight:700;font-family:monospace;">{{ l.quantiteProposee | number:'1.0-0' }}</td>
                </ng-container>
                <ng-container matColumnDef="unite">
                  <th mat-header-cell *matHeaderCellDef>Unité</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.82rem;color:var(--text-secondary);">{{ l.produitUnite }}</td>
                </ng-container>
                <ng-container matColumnDef="expireDate">
                  <th mat-header-cell *matHeaderCellDef>Péremption (FEFO)</th>
                  <td mat-cell *matCellDef="let l" style="font-size:.82rem;color:var(--text-secondary);">{{ l.expireDate ? (l.expireDate | date:'dd/MM/yyyy') : '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let l" style="text-align:right;">
                    <button mat-icon-button color="warn" (click)="supprimerLigne(l)" matTooltip="Supprimer">
                      <mat-icon style="font-size:18px;width:18px;height:18px;">delete_outline</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['produit','source','destination','quantite','unite','expireDate','action']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['produit','source','destination','quantite','unite','expireDate','action'];"></tr>
                <tr class="mat-row" *matNoDataRow>
                  <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-secondary);">
                    <mat-icon style="display:block;font-size:2rem;width:2rem;height:2rem;margin:0 auto .5rem;">playlist_add</mat-icon>
                    Aucune ligne — utilisez le formulaire ci-dessus pour construire le plan
                  </td>
                </tr>
              </table>
              <mat-paginator [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
            </mat-card-content>
          </mat-card>

        </ng-container><!-- fin !loadingAnalyse -->
      </ng-container><!-- fin programmeId -->
    </ng-container><!-- fin mode manuel -->
  `
})
export class GenerationComponent implements OnInit, AfterViewInit {

  periodes: PeriodeSaisie[] = [];
  programmes: Programme[] = [];
  regionNom = '';
  periodeId: number | null = null;
  programmeId: number | null = null;
  regionId: number | null = null;
  notes = '';

  plan: PlanReattribution | null = null;
  dsLignes = new MatTableDataSource<LignePlan>([]);
  loading = false;
  validating = false;
  error = '';

  // Colonnes table IA selon statut plan
  readonly colsBrouillon = ['produit', 'source', 'destination', 'quantite', 'expireDate', 'statut', 'actionsIA'];
  readonly colsValide    = ['produit', 'source', 'destination', 'quantite', 'qtExec', 'statut', 'actionsIA'];

  // Mode IA — édition d'une ligne
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

  // Mode IA — exécution d'une ligne
  executingLigne: LignePlan | null = null;
  execQuantite: number | null = null;
  execNotes = '';
  executingEnCours = false;
  erreurExecution = '';

  // Mode manuel
  analyse: AnalyseResultat | null = null;
  produitsEnTension: AnalyseProduit[] = [];
  loadingAnalyse = false;
  erreurAjout = '';

  nvl: {
    produitId: number | null;
    cibleId:   number | null;
    sourceId:  number | null;
    quantite:  number | null;
    expireDate: string | null;
    stockNet:  number | null;
    stockBrut: number | null;
    loadingStock: boolean;
    ajoutEnCours: boolean;
  } = this.nvlVide();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private snackBar = inject(MatSnackBar);

  constructor(
    private planService: PlanService,
    private stockService: StockService,
    private refService: ReferentielService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.isGestionnaire()) {
      this.router.navigate(['/plans/suivi']);
      return;
    }
    this.regionId = this.auth.regionId;
    this.refService.getPeriodes().subscribe(p => this.periodes = p);
    this.refService.getProgrammes().subscribe(p => this.programmes = p);
    if (this.regionId) {
      this.refService.getRegions().subscribe(regions => {
        const r = regions.find(x => x.id === this.regionId);
        this.regionNom = r ? r.nom : `Région #${this.regionId}`;
      });
    }
  }

  ngAfterViewInit(): void {
    this.dsLignes.paginator = this.paginator;
    this.dsLignes.sort = this.sort;
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  get nbLignesExecutees(): number {
    return this.plan?.lignes?.filter(l => l.statut === 'EXECUTE').length ?? 0;
  }

  get ciblesDisponibles(): StructureAnalyse[] {
    const p = this.produitsEnTension.find(p => p.produitId === this.nvl.produitId);
    return p ? [...(p.structuresEnRupture ?? []), ...(p.structuresEnTension ?? [])] : [];
  }

  get sourcesDisponibles(): StructureAnalyse[] {
    const p = this.produitsEnTension.find(p => p.produitId === this.nvl.produitId);
    return p ? (p.structuresEnSurstock ?? []) : [];
  }

  get quantiteDepasse(): boolean {
    return this.nvl.quantite !== null && this.nvl.stockNet !== null
        && this.nvl.quantite > this.nvl.stockNet;
  }

  get peutAjouter(): boolean {
    return !!this.nvl.produitId && !!this.nvl.cibleId && !!this.nvl.sourceId
        && this.nvl.quantite !== null && this.nvl.quantite > 0
        && !this.quantiteDepasse && !this.nvl.loadingStock;
  }

  get editQuantiteDepasse(): boolean {
    return this.editForm.quantite !== null && this.editForm.stockNet !== null
        && this.editForm.quantite > this.editForm.stockNet;
  }

  get peutSauvegarderEdit(): boolean {
    return this.editForm.quantite !== null && this.editForm.quantite > 0
        && !this.editQuantiteDepasse && !this.editForm.loadingStock && !this.editForm.saving;
  }

  // ── Statut chips ─────────────────────────────────────────────────────────────

  statutColor(statut: string): string {
    switch (statut) {
      case 'EXECUTE':  return '#15803d';
      case 'PARTIEL':  return '#92400e';
      case 'ANNULE':   return '#b91c1c';
      default:         return '#4338ca'; // PROPOSE
    }
  }

  statutBg(statut: string): string {
    switch (statut) {
      case 'EXECUTE':  return 'rgba(22,163,74,.12)';
      case 'PARTIEL':  return 'rgba(217,119,6,.12)';
      case 'ANNULE':   return 'rgba(220,38,38,.1)';
      default:         return 'rgba(99,102,241,.1)';
    }
  }

  // ── Génération ───────────────────────────────────────────────────────────────

  generer(): void {
    if (!this.periodeId || !this.regionId) return;
    this.loading = true; this.error = ''; this.plan = null;
    this.analyse = null; this.produitsEnTension = [];
    this.planService.generer(this.periodeId, this.programmeId, this.regionId, this.notes).subscribe({
      next: p => {
        this.plan = p;
        this.dsLignes.data = p.lignes ?? [];
        this.loading = false;
        setTimeout(() => {
          this.dsLignes.paginator = this.paginator;
          this.dsLignes.sort = this.sort;
        });
        if (!p.genereParlA && this.programmeId) {
          this.chargerAnalyse();
        }
      },
      error: err => { this.error = err.error?.message || 'Erreur lors de la génération'; this.loading = false; }
    });
  }

  chargerAnalyse(): void {
    if (!this.periodeId || !this.programmeId || !this.regionId) return;
    this.loadingAnalyse = true;
    this.stockService.analyser(this.periodeId, this.programmeId, this.regionId).subscribe({
      next: a => {
        this.analyse = a;
        this.produitsEnTension = (a.produits ?? []).filter(
          p => (p.structuresEnRupture?.length ?? 0) + (p.structuresEnTension?.length ?? 0) > 0
        );
        this.loadingAnalyse = false;
      },
      error: () => this.loadingAnalyse = false
    });
  }

  // ── Mode IA — édition d'une ligne ────────────────────────────────────────────

  startEdit(ligne: LignePlan): void {
    this.editingLigne = ligne;
    this.erreurEdition = '';
    this.editForm = {
      quantite: ligne.quantiteProposee,
      notes: ligne.notes ?? '',
      stockNet: null,
      stockBrut: null,
      loadingStock: true,
      saving: false
    };
    this.planService.getStockSource(
      this.periodeId!, ligne.produitId, ligne.structureSourceId, this.plan!.id, ligne.id
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

  // ── Mode IA — exécution d'une ligne ─────────────────────────────────────────

  startExecute(ligne: LignePlan): void {
    this.executingLigne = ligne;
    this.execQuantite   = ligne.quantiteProposee;
    this.execNotes      = '';
    this.erreurExecution = '';
  }

  cancelExecute(): void {
    this.executingLigne = null;
    this.execQuantite   = null;
    this.execNotes      = '';
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
        this.executingLigne  = null;
        this.execQuantite    = null;
        this.executingEnCours = false;
        this.snackBar.open('Exécution enregistrée.', 'OK', { duration: 2500 });
      },
      error: err => {
        this.erreurExecution  = err.error?.message || "Erreur lors de l'exécution";
        this.executingEnCours = false;
      }
    });
  }

  // ── Mode manuel ──────────────────────────────────────────────────────────────

  onProduitChange(): void {
    this.nvl = { ...this.nvlVide(), produitId: this.nvl.produitId };
  }

  onCibleChange(): void { /* la cible ne déclenche pas de chargement stock */ }

  onSourceChange(): void {
    this.nvl.quantite   = null;
    this.nvl.expireDate = null;
    this.nvl.stockNet   = null;
    this.nvl.stockBrut  = null;
    if (!this.nvl.produitId || !this.nvl.sourceId || !this.plan) return;
    this.nvl.loadingStock = true;
    this.planService.getStockSource(
      this.periodeId!, this.nvl.produitId, this.nvl.sourceId, this.plan.id
    ).subscribe({
      next: info => {
        this.nvl.expireDate   = info.expireDateFefo;
        this.nvl.stockNet     = info.stockNet;
        this.nvl.stockBrut    = info.stockBrut;
        this.nvl.loadingStock = false;
      },
      error: err => {
        this.erreurAjout = err.error?.message || 'Impossible de charger le stock source';
        this.nvl.loadingStock = false;
      }
    });
  }

  ajouterLigneManuel(): void {
    if (!this.peutAjouter || !this.plan) return;
    this.nvl.ajoutEnCours = true;
    this.erreurAjout = '';
    this.planService.ajouterLigne(this.plan.id, {
      produitId:         this.nvl.produitId,
      structureCibleId:  this.nvl.cibleId,
      structureSourceId: this.nvl.sourceId,
      quantiteProposee:  this.nvl.quantite
    } as any).subscribe({
      next: ligne => {
        this.plan!.lignes = [...(this.plan!.lignes ?? []), ligne];
        this.dsLignes.data = this.plan!.lignes;
        this.nvl = this.nvlVide();
        this.snackBar.open('Ligne ajoutée.', 'OK', { duration: 2000 });
      },
      error: err => {
        this.erreurAjout = err.error?.message || "Erreur lors de l'ajout";
        this.nvl.ajoutEnCours = false;
      }
    });
  }

  supprimerLigne(ligne: LignePlan): void {
    if (!this.plan) return;
    const wasValide = this.plan.statut !== 'BROUILLON';
    this.planService.supprimerLigne(this.plan.id, ligne.id).subscribe({
      next: () => {
        this.plan!.lignes = this.plan!.lignes.filter(l => l.id !== ligne.id);
        this.dsLignes.data = this.plan!.lignes;
        this.snackBar.open('Ligne supprimée.', 'OK', { duration: 2000 });
        // Recharger le plan si VALIDE : la suppression peut avoir déclenché la clôture automatique
        if (wasValide && this.plan) {
          this.planService.getPlan(this.plan.id).subscribe(updated => {
            this.plan = updated;
            this.dsLignes.data = updated.lignes ?? [];
            if (updated.statut === 'CLOTURE') {
              this.snackBar.open('Toutes les lignes exécutées — plan clôturé automatiquement.', 'OK', { duration: 4000 });
            }
          });
        }
      },
      error: err => { this.erreurAjout = err.error?.message || 'Erreur lors de la suppression'; }
    });
  }

  // ── Validation globale du plan ───────────────────────────────────────────────

  valider(): void {
    if (!this.plan) return;
    this.validating = true;
    this.error = '';
    this.planService.valider(this.plan.id).subscribe({
      next: updated => {
        if (this.plan!.genereParlA) {
          // Mode IA : rester sur la page pour enregistrer les exécutions ligne par ligne
          this.plan = updated;
          this.dsLignes.data = updated.lignes ?? [];
          this.validating = false;
          this.snackBar.open(
            'Plan validé — enregistrez les exécutions ligne par ligne.',
            'OK', { duration: 4000 }
          );
        } else {
          // Mode manuel : naviguer vers le suivi
          this.snackBar.open('Plan validé avec succès.', 'OK', { duration: 3000 });
          this.router.navigate(['/plans/suivi']);
        }
      },
      error: err => {
        this.error = err.error?.message || 'Erreur validation';
        this.validating = false;
      }
    });
  }

  reinitialiser(): void {
    this.plan = null; this.analyse = null;
    this.produitsEnTension = []; this.dsLignes.data = [];
    this.nvl = this.nvlVide(); this.error = ''; this.erreurAjout = '';
    this.editingLigne = null; this.editForm = this.editFormVide();
    this.executingLigne = null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private nvlVide() {
    return { produitId: null, cibleId: null, sourceId: null, quantite: null,
             expireDate: null, stockNet: null, stockBrut: null,
             loadingStock: false, ajoutEnCours: false };
  }

  private editFormVide() {
    return { quantite: null, notes: '', stockNet: null, stockBrut: null,
             loadingStock: false, saving: false };
  }
}
