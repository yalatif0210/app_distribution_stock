import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import Chart from 'chart.js/auto';
import { forkJoin, of } from 'rxjs';
import { TableauBordService } from '../../core/services/tableau-bord.service';
import { PeriodeService } from '../../core/services/periode.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { PlanService } from '../../core/services/plan.service';
import { AuthService } from '../../core/auth/auth.service';
import { AnalysesService, Tendance } from '../../core/services/analyses.service';
import { AnalysesOngletComponent } from './analyses-onglet.component';
import { ExplicationComponent } from './explication.component';
import {
  TableauBordDTO, MsdEvolution, RuptureEvolution,
  ProportionStockage, DisponibiliteItem, PlanReattribution, ExecutionProgressionItem, LignePlan
} from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatSelectModule, MatTabsModule, MatInputModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
    AnalysesOngletComponent, ExplicationComponent
  ],
  styles: [`
    .spark { display:flex; align-items:center; gap:.4rem; margin-top:.6rem; padding-top:.5rem; border-top:1px dashed var(--border-color);
             font-size:.68rem; color:var(--text-secondary); cursor:help; }
    .spark svg { width:110px; height:26px; flex-shrink:0; }
  `],
  template: `
    <!-- Header -->
    <div class="page-header">
      <h1>Tableau de bord analytique</h1>
      <p>Impact des plans de redistribution sur les niveaux de stock</p>
    </div>

    <!-- Filters -->
    <mat-card style="margin-bottom:1.25rem;">
      <mat-card-content style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; padding-top:.5rem;">
        <mat-form-field appearance="fill" style="flex:1; min-width:160px;">
          <mat-label>Période</mat-label>
          <mat-select [(ngModel)]="selectedPeriodId" (selectionChange)="onPeriodChange()">
            <mat-option *ngFor="let p of periodOptions" [value]="p.value">{{ p.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1; min-width:160px;">
          <mat-label>Programme</mat-label>
          <mat-select [(ngModel)]="selectedProgrammeId" (selectionChange)="onProgrammeChange()">
            <mat-option *ngFor="let p of programmeOptions" [value]="p.value">{{ p.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="fill" style="flex:1; min-width:160px;">
          <mat-label>Plan</mat-label>
          <mat-select [(ngModel)]="selectedPlanId" [disabled]="planOptions.length === 0">
            <mat-option *ngFor="let p of planOptions" [value]="p.value">{{ p.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <button
          mat-raised-button
          color="primary"
          (click)="load()"
          [disabled]="!selectedPeriodId || !selectedProgrammeId || !selectedPlanId"
          style="height:56px; padding:0 1.5rem;"
          matTooltip="Charger le tableau de bord"
        >
          <mat-icon>bar_chart</mat-icon> Analyser
        </button>
      </mat-card-content>
    </mat-card>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay" style="height:300px;">
      <mat-spinner diameter="56"></mat-spinner>
      <span>Chargement des données…</span>
    </div>

    <ng-container *ngIf="!loading && data">

      <!-- Identification du plan affiché -->
      <div *ngIf="planAffiche as pl" role="note" aria-label="Plan affiché"
           style="display:flex;flex-wrap:wrap;align-items:center;gap:.4rem 1.25rem;padding:.75rem 1rem;margin-bottom:1rem;
                  background:var(--bg-card, #fff);border:1px solid var(--border-color);border-radius:.5rem;font-size:.85rem;">
        <span style="font-weight:700;font-size:.95rem;">Plan #{{ pl.id }}</span>
        <span style="display:inline-flex;align-items:center;gap:.3rem;" matTooltip="Région du plan : il appartient au pharmacien de cette région">
          <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--accent-color);">place</mat-icon><b>{{ pl.regionNom }}</b>
        </span>
        <span style="display:inline-flex;align-items:center;gap:.3rem;">
          <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--text-secondary);">medication</mat-icon>{{ pl.programmeNom }}
        </span>
        <span style="display:inline-flex;align-items:center;gap:.3rem;">
          <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--text-secondary);">event</mat-icon>Période {{ pl.periodeLibelle }}
        </span>
        <span class="badge" style="background:rgba(79,70,229,.1);color:#3730a3;border:1px solid rgba(79,70,229,.25);">{{ libelleStatutPlan(pl.statut) }}</span>
        <span *ngIf="pl.dateValidation" style="color:var(--text-secondary);">
          Validé le {{ pl.dateValidation | date:'dd/MM/yyyy' }}<ng-container *ngIf="pl.valideParUsername"> par <b style="color:var(--text-primary);">{{ pl.valideParUsername }}</b></ng-container>
        </span>
        <span style="color:var(--text-secondary);">
          {{ pl.genereParlA && !pl.basculeManuel ? 'Généré par le Système (IA)' : 'Construit manuellement' }} le {{ pl.dateGeneration | date:'dd/MM/yyyy' }}
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.9rem;font-size:.82rem;color:var(--text-secondary);">
        <span style="font-weight:700;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em;">« Après » le plan</span>
        <div role="radiogroup" aria-label="Base du calcul après le plan"
             style="display:inline-flex;border:1px solid var(--border-color);border-radius:.4rem;overflow:hidden;">
          <button type="button" role="radio" [attr.aria-checked]="data.baseApres === 'PREVUE'" (click)="changerBase('PREVUE')"
                  [style.background]="data.baseApres === 'PREVUE' ? 'var(--accent-color)' : 'transparent'"
                  [style.color]="data.baseApres === 'PREVUE' ? '#fff' : 'var(--text-primary)'"
                  style="border:none;padding:.35rem .8rem;font:inherit;font-size:.8rem;cursor:pointer;"
                  matTooltip="Si toutes les quantités prévues par le plan étaient livrées">Théorique (prévu)</button>
          <button type="button" role="radio" [attr.aria-checked]="data.baseApres === 'EXECUTEE'" (click)="changerBase('EXECUTEE')"
                  [disabled]="data.planStatut === 'BROUILLON'"
                  [style.background]="data.baseApres === 'EXECUTEE' ? 'var(--accent-color)' : 'transparent'"
                  [style.color]="data.baseApres === 'EXECUTEE' ? '#fff' : (data.planStatut === 'BROUILLON' ? 'var(--text-secondary)' : 'var(--text-primary)')"
                  style="border:none;border-left:1px solid var(--border-color);padding:.35rem .8rem;font:inherit;font-size:.8rem;cursor:pointer;"
                  [matTooltip]="data.planStatut === 'BROUILLON' ? 'Plan en brouillon : rien n\\'est encore exécuté' : 'Quantités réellement livrées'">Exécuté (réel)</button>
        </div>
        <span *ngIf="data.baseApres === 'PREVUE'">Situation si toutes les quantités prévues étaient livrées.</span>
        <span *ngIf="data.baseApres === 'EXECUTEE'">Situation avec les quantités réellement livrées à ce jour.</span>
      </div>

      <!-- KPI stat cards -->
      <div class="grid-4" style="margin-bottom:1.25rem;">
        <!-- Taux disponibilité -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Taux de disponibilité</div>
          <div style="display:flex; align-items:flex-end; gap:.75rem;">
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Avant</div>
              <div style="font-size:1.4rem;font-weight:700;">{{ data.tauxDispoGlobalAvant | number:'1.1-1' }}%</div>
            </div>
            <div style="color:var(--text-secondary);padding-bottom:6px;">→</div>
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Après</div>
              <div style="font-size:1.4rem;font-weight:700;" [style.color]="deltaTrend(data.tauxDispoGlobalApres - data.tauxDispoGlobalAvant)">
                {{ data.tauxDispoGlobalApres | number:'1.1-1' }}%
              </div>
            </div>
          </div>
          <div class="stat-delta" [style.color]="deltaTrend(data.tauxDispoGlobalApres - data.tauxDispoGlobalAvant)" style="margin-top:.5rem;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">{{ deltaMatIcon(data.tauxDispoGlobalApres - data.tauxDispoGlobalAvant) }}</mat-icon>
            {{ (data.tauxDispoGlobalApres - data.tauxDispoGlobalAvant) | number:'1.1-1' }}%
          </div>
          <div *ngIf="tendances.length > 1" class="spark" [matTooltip]="infoTendance('tauxDisponibilite', ' %')">
            <svg viewBox="0 0 110 26" aria-hidden="true">
              <polyline [attr.points]="spark('tauxDisponibilite')" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round" />
              <circle [attr.cx]="dernierPoint('tauxDisponibilite')[0]" [attr.cy]="dernierPoint('tauxDisponibilite')[1]" r="2.5" fill="#4f46e5" />
            </svg>
            <span>Tendance sur {{ tendances.length }} périodes</span>
          </div>
        </div>

        <!-- Taux bien stockés -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Taux bien stockés</div>
          <div style="display:flex; align-items:flex-end; gap:.75rem;">
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Avant</div>
              <div style="font-size:1.4rem;font-weight:700;">{{ data.tauxBienStockeGlobalAvant | number:'1.1-1' }}%</div>
            </div>
            <div style="color:var(--text-secondary);padding-bottom:6px;">→</div>
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Après</div>
              <div style="font-size:1.4rem;font-weight:700;" [style.color]="deltaTrend(data.tauxBienStockeGlobalApres - data.tauxBienStockeGlobalAvant)">
                {{ data.tauxBienStockeGlobalApres | number:'1.1-1' }}%
              </div>
            </div>
          </div>
          <div class="stat-delta" [style.color]="deltaTrend(data.tauxBienStockeGlobalApres - data.tauxBienStockeGlobalAvant)" style="margin-top:.5rem;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">{{ deltaMatIcon(data.tauxBienStockeGlobalApres - data.tauxBienStockeGlobalAvant) }}</mat-icon>
            {{ (data.tauxBienStockeGlobalApres - data.tauxBienStockeGlobalAvant) | number:'1.1-1' }}%
          </div>
          <div *ngIf="tendances.length > 1" class="spark" [matTooltip]="infoTendance('tauxBienStocke', ' %')">
            <svg viewBox="0 0 110 26" aria-hidden="true">
              <polyline [attr.points]="spark('tauxBienStocke')" fill="none" stroke="#16a34a" stroke-width="2" stroke-linejoin="round" />
              <circle [attr.cx]="dernierPoint('tauxBienStocke')[0]" [attr.cy]="dernierPoint('tauxBienStocke')[1]" r="2.5" fill="#16a34a" />
            </svg>
            <span>Tendance sur {{ tendances.length }} périodes</span>
          </div>
        </div>

        <!-- Indice de risque -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Indice de risque</div>
          <div style="display:flex; align-items:flex-end; gap:.75rem;">
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Avant</div>
              <div style="font-size:1.4rem;font-weight:700;color:#ef4444;">{{ data.analytique.indiceRisqueAvant | number:'1.2-2' }}</div>
            </div>
            <div style="color:var(--text-secondary);padding-bottom:6px;">→</div>
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Après</div>
              <div style="font-size:1.4rem;font-weight:700;" [style.color]="deltaTrend(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres)">
                {{ data.analytique.indiceRisqueApres | number:'1.2-2' }}
              </div>
            </div>
          </div>
          <div class="stat-delta" [style.color]="deltaTrend(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres)" style="margin-top:.5rem;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">{{ deltaMatIcon(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres) }}</mat-icon>
            {{ (data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres) | number:'1.2-2' }}
            <span style="color:var(--text-secondary);font-size:.75rem;margin-left:.25rem;">sur une échelle de 0 à 3 (↓ = mieux)</span>
          </div>
          <div *ngIf="tendances.length > 1" class="spark" [matTooltip]="infoTendance('indiceRisque', '')">
            <svg viewBox="0 0 110 26" aria-hidden="true">
              <polyline [attr.points]="spark('indiceRisque')" fill="none" stroke="#ef4444" stroke-width="2" stroke-linejoin="round" />
              <circle [attr.cx]="dernierPoint('indiceRisque')[0]" [attr.cy]="dernierPoint('indiceRisque')[1]" r="2.5" fill="#ef4444" />
            </svg>
            <span>Tendance sur {{ tendances.length }} périodes</span>
          </div>
        </div>

        <!-- Score d'impact -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Score d'impact global</div>
          <div style="font-size:2.5rem;font-weight:800;color:var(--accent-color);line-height:1;">
            {{ data.analytique.scoreImpactGlobal | number:'1.0-0' }}
          </div>
          <div style="margin-top:.75rem;display:flex;gap:.75rem;font-size:.8rem;">
            <span style="color:#22c55e;" matTooltip="Couples site/produit dont le MSD augmente"><mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">trending_up</mat-icon> {{ data.analytique.nbSitesAmeliores }} améliorés</span>
            <span style="color:#475569;" matTooltip="Couples site/produit ayant cédé du stock"><mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">call_made</mat-icon> {{ data.analytique.nbSourcesSollicitees }} sources</span>
            <span *ngIf="data.analytique.nbSitesSousSeuil > 0" style="color:#b45309;" matTooltip="Sources passées sous le seuil de sécurité (exception péremption)"><mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">warning</mat-icon> {{ data.analytique.nbSitesSousSeuil }} sous le seuil</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group animationDuration="200ms" (selectedTabChange)="onOnglet($event.index)">

        <!-- Tab A: Evolution MSD -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">show_chart</mat-icon> Evolution MSD
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon>show_chart</mat-icon>
              A. Évolution des Mois de Stock Disponible (MSD)
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);margin:-.25rem 0 .75rem;">
              Sites ayant participé au plan (source ou destination d'au moins un mouvement), produit par produit.
            </div>
            <app-explication>
              Chaque ligne est un couple produit / site. Le point gris donne le MSD avant le plan, le point coloré le MSD après ;
              le trait qui les relie montre le chemin parcouru : <b style="color:#16a34a;">vert</b> quand le site gagne du stock
              (destination), <b style="color:#dc2626;">rouge</b> quand il en cède (source). La ligne pointillée marque le seuil de
              sécurité de la région ({{ data.analytique.seuilSecurite }} mois) : une destination doit idéalement le franchir,
              une source ne doit pas passer dessous, sauf exception péremption.
            </app-explication>
            <div class="chart-container" style="margin-bottom:1.5rem;" [style.height.px]="hauteurHalteres">
              <canvas id="msdChart"></canvas>
            </div>
            <div style="padding:.25rem 0 .5rem;">
              <mat-form-field appearance="outline" style="width:100%;">
                <mat-label>Filtrer</mat-label>
                <input matInput #fMsd (input)="dsMsd.filter=fMsd.value.trim().toLowerCase(); dsMsd.paginator?.firstPage()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </div>
            <table mat-table [dataSource]="dsMsd" matSort #sortMsd="matSort" style="width:100%;">
              <ng-container matColumnDef="produit">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                <td mat-cell *matCellDef="let item" style="font-weight:500;font-size:.85rem;">{{ item.produitNom }}</td>
              </ng-container>
              <ng-container matColumnDef="site">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Site</th>
                <td mat-cell *matCellDef="let item" style="font-size:.85rem;color:var(--text-secondary);">{{ item.structureNom }}</td>
              </ng-container>
              <ng-container matColumnDef="msdAvant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">MSD avant</th>
                <td mat-cell *matCellDef="let item" style="text-align:right;font-family:monospace;">{{ item.msdAvant | number:'1.1-1' }}</td>
              </ng-container>
              <ng-container matColumnDef="msdApres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">MSD après</th>
                <td mat-cell *matCellDef="let item" style="text-align:right;font-family:monospace;font-weight:600;">{{ item.msdApres | number:'1.1-1' }}</td>
              </ng-container>
              <ng-container matColumnDef="delta">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Delta</th>
                <td mat-cell *matCellDef="let item" style="text-align:right;">
                  <span [style.color]="deltaTrend(item.deltaMsd)" style="font-weight:600;font-family:monospace;">
                    {{ item.deltaMsd >= 0 ? '+' : '' }}{{ item.deltaMsd | number:'1.1-1' }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="tendance">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tendance</th>
                <td mat-cell *matCellDef="let item">
                  <span [style.color]="tendanceColor(item.tendance)" style="font-size:.8rem;font-weight:600;display:flex;align-items:center;gap:4px;">
                    <mat-icon style="font-size:14px;width:14px;height:14px;">{{ tendanceMatIcon(item.tendance) }}</mat-icon>
                    {{ item.tendance }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="statutAvant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut avant</th>
                <td mat-cell *matCellDef="let item">
                  <span [class]="'badge badge-' + item.statutAvant.toLowerCase().replace('_', '-')">{{ item.statutAvant }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="statutApres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut après</th>
                <td mat-cell *matCellDef="let item">
                  <span [class]="'badge badge-' + item.statutApres.toLowerCase().replace('_', '-')">{{ item.statutApres }}</span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['produit','site','msdAvant','msdApres','delta','tendance','statutAvant','statutApres']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['produit','site','msdAvant','msdApres','delta','tendance','statutAvant','statutApres'];"></tr>
            </table>
            <mat-paginator #pagMsd [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
          </div>
        </mat-tab>

        <!-- Tab B: Ruptures -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">warning</mat-icon> Ruptures
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:#ef4444;">warning</mat-icon>
              B. Évolution des ruptures de stock
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);margin:-.25rem 0 .75rem;">
              Nombre de sites en rupture avant et après le plan, pour les produits concernés (au moins une rupture avant ou après).
            </div>
            <app-explication>
              Pour chaque produit, la barre rouge compte les sites en rupture (stock nul, ou MSD nul) avant le plan, la barre verte
              ceux qui le restent après. Une barre verte plus courte signifie que le plan a sorti des sites de la rupture ;
              une barre verte aussi haute que la rouge, qu'aucun site de la région n'avait de quoi céder pour ce produit.
            </app-explication>
            <div *ngIf="data.evolutionRuptures.length === 0" style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:.875rem;">
              <mat-icon style="display:block;margin:0 auto .5rem;color:#22c55e;">check_circle</mat-icon>
              Aucun site en rupture, ni avant ni après ce plan.
            </div>
            <div class="chart-container" style="margin-bottom:1.5rem;" [style.display]="data.evolutionRuptures.length ? 'block' : 'none'">
              <canvas id="ruptureChart"></canvas>
            </div>
            <div style="padding:.25rem 0 .5rem;">
              <mat-form-field appearance="outline" style="width:100%;">
                <mat-label>Filtrer</mat-label>
                <input matInput #fRup (input)="dsRuptures.filter=fRup.value.trim().toLowerCase(); dsRuptures.paginator?.firstPage()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </div>
            <table mat-table [dataSource]="dsRuptures" matSort #sortRuptures="matSort" style="width:100%;">
              <ng-container matColumnDef="produit">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                <td mat-cell *matCellDef="let item" style="font-size:.8rem;">{{ item.produitNom }}</td>
              </ng-container>
              <ng-container matColumnDef="avant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="nbRupturesAvant" style="text-align:center;">Sites en rupture avant</th>
                <td mat-cell *matCellDef="let item" style="text-align:center;color:#ef4444;font-weight:600;">{{ item.nbRupturesAvant }}</td>
              </ng-container>
              <ng-container matColumnDef="apres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="nbRupturesApres" style="text-align:center;">Sites en rupture après</th>
                <td mat-cell *matCellDef="let item" style="text-align:center;font-weight:600;" [style.color]="item.nbRupturesApres < item.nbRupturesAvant ? '#22c55e' : '#ef4444'">{{ item.nbRupturesApres }}</td>
              </ng-container>
              <ng-container matColumnDef="delta">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:center;">Delta</th>
                <td mat-cell *matCellDef="let item" style="text-align:center;">
                  <span [style.color]="deltaTrend(item.nbRupturesAvant - item.nbRupturesApres)" style="font-weight:700;font-size:.8rem;">
                    <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">{{ tendanceMatIconRupture(item.tendance) }}</mat-icon>
                    {{ item.delta }}
                  </span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['produit','avant','apres','delta']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['produit','avant','apres','delta'];"></tr>
            </table>
            <mat-paginator #pagRuptures [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
          </div>
        </mat-tab>

        <!-- Tab C: Proportions -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">pie_chart</mat-icon> Proportions
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:#f97316;">pie_chart</mat-icon>
              C. Proportions de stockage
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);margin:-.25rem 0 .75rem;">
              Répartition des sites par statut, pour chaque produit géré sur au moins un site de la région.
            </div>
            <app-explication>
              Le premier graphique compare tous les produits d'un coup : chaque produit a deux barres (avant, après) qui
              totalisent 100 % des sites ayant soumis un état de stock, découpées par statut. Plus la part verte (« Bien stocké »)
              s'allonge entre la barre « avant » et la barre « après », plus le plan a été utile pour ce produit.
              Les camemberts en dessous détaillent un produit choisi dans la liste.
            </app-explication>
            <div *ngIf="proportionsSuivies.length" style="border:1px solid var(--border-color);border-radius:.5rem;padding:1rem;margin-bottom:1rem;">
              <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);margin-bottom:.5rem;">Tous les produits : répartition des sites par statut (100 %)</div>
              <div style="position:relative;" [style.height.px]="hauteurBarresProportions"><canvas id="propBarresChart"></canvas></div>
            </div>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;margin-bottom:.75rem;">
              <mat-form-field appearance="outline" style="flex:1;min-width:260px;max-width:520px;" subscriptSizing="dynamic">
                <mat-label>Produit</mat-label>
                <mat-select [(ngModel)]="produitProportionId" (selectionChange)="buildProportionCharts()">
                  <mat-option *ngFor="let p of data.proportionsStockage" [value]="p.produitId">{{ p.produitNom }}</mat-option>
                </mat-select>
              </mat-form-field>
              <div *ngIf="proportionCourante as p" style="font-size:.8rem;color:var(--text-secondary);">
                {{ p.nbSitesGerant }} site(s) gèrent ce produit · {{ p.nbSitesTotal }} avec un état de stock soumis
                <span *ngIf="p.nbSansSaisie > 0" style="color:#b45309;"> · {{ p.nbSansSaisie }} sans saisie, non comptés</span>
              </div>
            </div>
            <div *ngIf="proportionCourante && proportionCourante.nbSitesTotal === 0"
                 style="padding:1.5rem;text-align:center;color:var(--text-secondary);font-size:.875rem;">
              Aucun état de stock soumis pour ce produit sur la période.
            </div>
            <div [style.display]="proportionCourante && proportionCourante.nbSitesTotal > 0 ? 'grid' : 'none'"
                 style="grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1rem;">
              <div style="border:1px solid var(--border-color);border-radius:.5rem;padding:1rem;">
                <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);text-align:center;margin-bottom:.5rem;">Avant le plan</div>
                <div style="position:relative;height:280px;"><canvas id="propAvantChart"></canvas></div>
              </div>
              <div style="border:1px solid var(--border-color);border-radius:.5rem;padding:1rem;">
                <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);text-align:center;margin-bottom:.5rem;">Après le plan</div>
                <div style="position:relative;height:280px;"><canvas id="propApresChart"></canvas></div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab D: Disponibilité -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">check_circle</mat-icon> Disponibilité
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:#22c55e;">check_circle</mat-icon>
              D. Disponibilité des produits
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);margin:-.25rem 0 .75rem;">
              Pour chaque produit : nombre de sites avec un stock supérieur à 0, sur le nombre de sites qui gèrent ce produit dans la région.
            </div>
            <app-explication titre="Ce que montre ce tableau">
              La disponibilité répond à la question « le patient trouve-t-il le produit ? », quel que soit le niveau de stock :
              un site est disponible dès qu'il a au moins une unité. Les sites qui gèrent le produit sans avoir soumis leur état
              de stock comptent comme non disponibles, pour ne pas embellir le résultat. Le delta montre combien de points de
              disponibilité le plan fait gagner.
            </app-explication>
            <div style="padding:.25rem 0 .5rem;">
              <mat-form-field appearance="outline" style="width:100%;">
                <mat-label>Filtrer</mat-label>
                <input matInput #fDispo (input)="dsDisponibilites.filter=fDispo.value.trim().toLowerCase(); dsDisponibilites.paginator?.firstPage()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </div>
            <table mat-table [dataSource]="dsDisponibilites" matSort #sortDispo="matSort" style="width:100%;">
              <ng-container matColumnDef="produit">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="min-width:160px;">Produit</th>
                <td mat-cell *matCellDef="let item" style="font-weight:500;font-size:.875rem;">{{ item.produitNom }}</td>
              </ng-container>
              <ng-container matColumnDef="gerant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="nbSitesGerant" style="text-align:center;">Sites gérant</th>
                <td mat-cell *matCellDef="let item" style="text-align:center;font-family:monospace;">
                  {{ item.nbSitesGerant }}
                  <div *ngIf="item.nbSansSaisie > 0" style="font-size:.7rem;color:#b45309;font-family:inherit;" matTooltip="Sites gérant le produit sans état de stock soumis : comptés comme non disponibles">{{ item.nbSansSaisie }} sans saisie</div>
                </td>
              </ng-container>
              <ng-container matColumnDef="dispoAvant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="tauxDispoAvant">Disponibilité avant</th>
                <td mat-cell *matCellDef="let item">
                  <div style="display:flex;align-items:center;gap:.5rem;">
                    <mat-progress-bar mode="determinate" [value]="item.tauxDispoAvant" style="width:110px;" color="accent"></mat-progress-bar>
                    <span style="font-size:.8rem;font-family:monospace;white-space:nowrap;">{{ item.nbDispoAvant }}/{{ item.nbSitesGerant }} · {{ item.tauxDispoAvant | number:'1.0-0' }}%</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="dispoApres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="tauxDispoApres">Disponibilité après plan</th>
                <td mat-cell *matCellDef="let item">
                  <div style="display:flex;align-items:center;gap:.5rem;">
                    <mat-progress-bar mode="determinate" [value]="item.tauxDispoApres" style="width:110px;" color="primary"></mat-progress-bar>
                    <span style="font-size:.8rem;font-family:monospace;white-space:nowrap;font-weight:600;" [style.color]="deltaTrend(item.deltaDispo)">
                      {{ item.nbDispoApres }}/{{ item.nbSitesGerant }} · {{ item.tauxDispoApres | number:'1.0-0' }}%
                    </span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="delta">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Delta</th>
                <td mat-cell *matCellDef="let item" style="text-align:right;">
                  <span [style.color]="deltaTrend(item.deltaDispo)" style="font-weight:600;font-size:.8rem;font-family:monospace;">
                    {{ item.deltaDispo >= 0 ? '+' : '' }}{{ item.deltaDispo | number:'1.1-1' }}%
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="tendance">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tendance</th>
                <td mat-cell *matCellDef="let item">
                  <span [style.color]="tendanceColor(item.tendance)" style="font-size:.75rem;font-weight:600;display:flex;align-items:center;gap:3px;">
                    <mat-icon style="font-size:14px;width:14px;height:14px;">{{ tendanceMatIcon(item.tendance) }}</mat-icon>
                    {{ item.tendance }}
                  </span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['produit','gerant','dispoAvant','dispoApres','delta','tendance']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['produit','gerant','dispoAvant','dispoApres','delta','tendance'];"></tr>
            </table>
            <mat-paginator #pagDispo [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
          </div>
        </mat-tab>

        <!-- Tab F: Exécution du plan -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">task_alt</mat-icon> Exécution
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:var(--accent-color);">task_alt</mat-icon>
              F. Niveau d'exécution du plan sélectionné
            </div>
            <app-explication>
              L'anneau donne la part des lignes du plan déjà exécutées (totalement ou partiellement). Le tableau détaille chaque
              mouvement : quantité prévue, quantité réellement livrée et statut. Tant que l'exécution est faible, la vue
              « Exécuté (réel) » montre peu d'effet : comparez-la à la vue « Théorique » pour mesurer ce qui reste à livrer.
            </app-explication>
            <div style="display:grid;grid-template-columns:240px 1fr;gap:1.5rem;align-items:start;">
              <!-- Camembert -->
              <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;padding:1rem;text-align:center;">
                <div style="font-size:.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;">Avancement</div>
                <div style="position:relative;height:180px;">
                  <canvas id="executionChart"></canvas>
                </div>
                <div style="margin-top:.75rem;font-size:1.5rem;font-weight:800;" [style.color]="kpiColor(data!.analytique.completudeExecution)">
                  {{ data!.analytique.completudeExecution | number:'1.0-0' }}%
                </div>
                <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem;">
                  {{ data!.analytique.completudeExecution | number:'1.0-0' }}% des lignes exécutées
                </div>
              </div>
              <!-- Table lignes -->
              <div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;">Détail des lignes du plan</div>
                <div *ngIf="loadingLines" style="text-align:center;padding:2rem;color:var(--text-secondary);">
                  <mat-spinner diameter="32" style="margin:0 auto;"></mat-spinner>
                </div>
                <ng-container *ngIf="!loadingLines && planDetails">
                  <div style="padding:.25rem 0 .5rem;">
                    <mat-form-field appearance="outline" style="width:100%;">
                      <mat-label>Filtrer</mat-label>
                      <input matInput #fLignes (input)="dsLignesPlan.filter=fLignes.value.trim().toLowerCase(); dsLignesPlan.paginator?.firstPage()">
                      <mat-icon matSuffix>search</mat-icon>
                    </mat-form-field>
                  </div>
                <table mat-table [dataSource]="dsLignesPlan" matSort #sortLignes="matSort" style="width:100%;">
                  <ng-container matColumnDef="produit">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                    <td mat-cell *matCellDef="let l" style="font-size:.8rem;font-weight:500;">{{ l.produitNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="source">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                    <td mat-cell *matCellDef="let l" style="font-size:.8rem;color:var(--text-secondary);">{{ l.structureSourceNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="cible">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Cible</th>
                    <td mat-cell *matCellDef="let l" style="font-size:.8rem;color:#22c55e;">{{ l.structureCibleNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="proposee">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Proposée</th>
                    <td mat-cell *matCellDef="let l" style="text-align:right;font-family:monospace;font-size:.8rem;">{{ l.quantiteProposee | number:'1.0-0' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="unite">
                    <th mat-header-cell *matHeaderCellDef>Unité</th>
                    <td mat-cell *matCellDef="let l" style="font-size:.75rem;color:var(--text-secondary);">{{ l.produitUnite }}</td>
                  </ng-container>
                  <ng-container matColumnDef="executee">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;">Exécutée</th>
                    <td mat-cell *matCellDef="let l" style="text-align:right;font-family:monospace;font-size:.8rem;font-weight:600;">{{ (l.quantiteExecutee ?? 0) | number:'1.0-0' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="statut">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
                    <td mat-cell *matCellDef="let l">
                      <span [style.background]="statutLigneBg(l.statut)" [style.color]="statutLigneColor(l.statut)"
                            style="padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700;">{{ l.statut }}</span>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="['produit','source','cible','proposee','unite','executee','statut']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['produit','source','cible','proposee','unite','executee','statut'];"></tr>
                  <tr class="mat-row" *matNoDataRow>
                    <td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucune ligne</td>
                  </tr>
                </table>
                <mat-paginator #pagLignes [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
                </ng-container>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab E: Analytics -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">analytics</mat-icon> Analytics
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:#a855f7;">bolt</mat-icon>
              E. Analyse avancée
            </div>
            <app-explication titre="Ce que montrent ces indicateurs">
              « Produits sans rupture » compte les produits du programme pour lesquels aucun site n'est en rupture : c'est la
              couverture du programme. La complétude d'exécution reprend l'anneau de l'onglet Exécution. Les trois pavés comptent
              les couples site/produit améliorés, les sources sollicitées et celles passées sous le seuil de sécurité (seule
              l'exception péremption l'autorise). Le Top 5 classe les mouvements par gain de MSD apporté à la destination.
              Pour aller plus loin, ouvrez l'onglet « Synthèses ».
            </app-explication>
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:1.5rem;flex-wrap:wrap;">
              <!-- Métriques -->
              <div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:1rem;">Indicateurs composites</div>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);"
                       matTooltip="Produits du programme sans aucun site en rupture, sur les produits ayant au moins un état de stock soumis">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Produits sans rupture avant</span>
                    <span style="font-weight:700;font-family:monospace;">{{ data.analytique.nbProduitsSansRuptureAvant }}/{{ data.analytique.nbProduitsSuivis }} · {{ data.analytique.tauxCouvertureProgrammeAvant | number:'1.0-1' }} %</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Produits sans rupture après</span>
                    <span style="font-weight:700;font-family:monospace;" [style.color]="deltaTrend(data.analytique.tauxCouvertureProgrammeApres - data.analytique.tauxCouvertureProgrammeAvant)">
                      {{ data.analytique.nbProduitsSansRuptureApres }}/{{ data.analytique.nbProduitsSuivis }} · {{ data.analytique.tauxCouvertureProgrammeApres | number:'1.0-1' }} %
                    </span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Complétude d'exécution</span>
                    <span style="font-weight:700;font-family:monospace;" [style.color]="kpiColor(data.analytique.completudeExecution)">
                      {{ data.analytique.completudeExecution | number:'1.1-1' }}%
                    </span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:.5rem;margin-top:.25rem;">
                    <div style="padding:.75rem;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:.375rem;text-align:center;">
                      <div style="font-size:1.5rem;font-weight:800;color:#22c55e;">{{ data.analytique.nbSitesAmeliores }}</div>
                      <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;">Sites améliorés</div>
                    </div>
                    <div style="padding:.75rem;background:rgba(100,116,139,.08);border:1px solid rgba(100,116,139,.3);border-radius:.375rem;text-align:center;">
                      <div style="font-size:1.5rem;font-weight:800;color:#475569;">{{ data.analytique.nbSourcesSollicitees }}</div>
                      <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;">Sources sollicitées</div>
                    </div>
                    <div style="padding:.75rem;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.3);border-radius:.375rem;text-align:center;"
                         [matTooltip]="'Sources dont le MSD après le plan est sous le seuil de sécurité de la région (' + data.analytique.seuilSecurite + ' mois) : seule l\\'exception péremption le permet'">
                      <div style="font-size:1.5rem;font-weight:800;color:#b45309;">{{ data.analytique.nbSitesSousSeuil }}</div>
                      <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;">Passés sous le seuil</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top 5 mouvements -->
              <div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Top 5 mouvements à impact</div>
                <div style="padding:.25rem 0 .5rem;">
                  <mat-form-field appearance="outline" style="width:100%;">
                    <mat-label>Filtrer</mat-label>
                    <input matInput #fTop5 (input)="dsTop5.filter=fTop5.value.trim().toLowerCase(); dsTop5.paginator?.firstPage()">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>
                <table mat-table [dataSource]="dsTop5" matSort #sortTop5="matSort" style="width:100%;">
                  <ng-container matColumnDef="rank">
                    <th mat-header-cell *matHeaderCellDef style="width:30px;">#</th>
                    <td mat-cell *matCellDef="let mv; let i = index" style="color:var(--accent-color);font-weight:700;">{{ i + 1 }}</td>
                  </ng-container>
                  <ng-container matColumnDef="produit">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th>
                    <td mat-cell *matCellDef="let mv" style="font-weight:500;font-size:.875rem;">{{ mv.produitNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="source">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                    <td mat-cell *matCellDef="let mv" style="font-size:.8rem;color:var(--text-secondary);">{{ mv.structureSourceNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="cible">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Cible</th>
                    <td mat-cell *matCellDef="let mv" style="font-size:.8rem;color:#22c55e;font-weight:500;">{{ mv.structureCibleNom }}</td>
                  </ng-container>
                  <ng-container matColumnDef="quantite">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;width:90px;">Quantité</th>
                    <td mat-cell *matCellDef="let mv" style="text-align:right;font-family:monospace;font-weight:600;">{{ mv.quantiteProposee }}</td>
                  </ng-container>
                  <ng-container matColumnDef="gain">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:right;width:90px;">Gain MSD</th>
                    <td mat-cell *matCellDef="let mv" style="text-align:right;">
                      <span style="color:#22c55e;font-weight:700;font-family:monospace;">+{{ mv.gainMsdCible | number:'1.1-1' }}</span>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="['rank','produit','source','cible','quantite','gain']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['rank','produit','source','cible','quantite','gain'];"></tr>
                  <tr class="mat-row" *matNoDataRow>
                    <td colspan="6" style="text-align:center;color:var(--text-secondary);padding:1.5rem;">Aucun mouvement disponible</td>
                  </tr>
                </table>
                <mat-paginator #pagTop5 [pageSizeOptions]="[5, 10, 25]" showFirstLastButtons></mat-paginator>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab G: Synthèses -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:.4rem;">insights</mat-icon> Synthèses
          </ng-template>
          <ng-template matTabContent>
            <div style="padding:1rem 0;">
              <app-analyses-onglet [periodeId]="charge.periodeId" [programmeId]="charge.programmeId"
                                   [planId]="charge.planId" [base]="data.baseApres"></app-analyses-onglet>
            </div>
          </ng-template>
        </mat-tab>

      </mat-tab-group>

    </ng-container>

    <!-- Empty state -->
    <ng-container *ngIf="!loading && !data">
      <div style="text-align:center;padding:4rem 2rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;color:var(--text-secondary);">
        <mat-icon style="font-size:3rem;width:3rem;height:3rem;display:block;margin:0 auto 1rem;color:var(--border-color);">bar_chart</mat-icon>
        <div style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem;color:var(--text-primary);">Sélectionnez vos filtres</div>
        <div style="font-size:.875rem;">Choisissez une période, un programme et un plan pour afficher le tableau de bord.</div>
      </div>
    </ng-container>

    <!-- Section H: Progression annuelle (indépendante) -->
    <div style="margin-top:2rem;">
      <div class="section-title">
        <mat-icon style="color:var(--info);">trending_up</mat-icon>
        H. Progression annuelle des plans validés
      </div>
      <div style="font-size:.8rem;color:var(--text-secondary);margin:-.25rem 0 .75rem;">
        Avancement moyen des plans validés, mois par mois : part des lignes exécutées au moins partiellement.
        Le programme comparé est tracé à côté de l'ensemble des plans.
      </div>
      <app-explication>
        Chaque point est la moyenne, pour les plans validés du mois, de la part de leurs lignes exécutées au moins
        partiellement. Une courbe qui monte vers 100 % traduit des plans exécutés rapidement ; une courbe basse ou en baisse
        signale des plans validés mais peu suivis d'effet. L'écart entre la courbe du programme (pointillés) et celle de
        l'ensemble des plans montre si ce programme s'exécute mieux ou moins bien que les autres.
      </app-explication>
      <mat-card style="margin-bottom:1.25rem;">
        <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
          <mat-form-field appearance="fill" style="width:120px;">
            <mat-label>Année</mat-label>
            <input matInput type="number" [(ngModel)]="progressionAnnee" [min]="2020" [max]="2099">
          </mat-form-field>
          <mat-form-field appearance="fill" style="min-width:180px;">
            <mat-label>Programme comparé</mat-label>
            <mat-select [(ngModel)]="progressionProgrammeId" (selectionChange)="loadProgression()">
              <mat-option [value]="null">Aucun (tous les plans seulement)</mat-option>
              <mat-option *ngFor="let p of programmeOptions" [value]="p.value">{{ p.label }}</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-stroked-button color="primary" (click)="loadProgression()" [disabled]="loadingProgression" style="height:56px;padding:0 1.25rem;">
            <mat-icon>refresh</mat-icon> Actualiser
          </button>
        </mat-card-content>
      </mat-card>

      <div *ngIf="loadingProgression" class="loading-overlay" style="height:200px;">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loadingProgression">
        <mat-card-content>
          <div *ngIf="erreurProgression" style="text-align:center;padding:2rem;color:#b91c1c;font-size:.875rem;">
            <mat-icon style="font-size:2rem;width:2rem;height:2rem;display:block;margin:0 auto .5rem;">error_outline</mat-icon>
            {{ erreurProgression }}
          </div>
          <div *ngIf="!erreurProgression && progressionItems.length === 0" style="text-align:center;padding:2rem;color:var(--text-secondary);font-size:.875rem;">
            <mat-icon style="font-size:2rem;width:2rem;height:2rem;display:block;margin:0 auto .5rem;">hourglass_empty</mat-icon>
            Aucun plan validé trouvé pour {{ progressionAnnee }}
          </div>
          <div *ngIf="progressionItems.length > 0" class="chart-container" style="height:260px;">
            <canvas id="progressionChart"></canvas>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: TableauBordDTO | null = null;
  loading = false;

  periodOptions: { label: string; value: number; annee?: number }[] = [];
  programmeOptions: { label: string; value: number }[] = [];
  planOptions: { label: string; value: number }[] = [];

  selectedPeriodId: number | null = null;
  selectedProgrammeId: number | null = null;
  selectedPlanId: number | null = null;

  planDetails: PlanReattribution | null = null;
  loadingLines = false;

  progressionItems: ExecutionProgressionItem[] = [];
  /** Progression du programme comparé (vide si aucun). */
  progressionItemsProgramme: ExecutionProgressionItem[] = [];
  /** Erreur de chargement de la progression annuelle (distincte de « aucun plan »). */
  erreurProgression = '';
  /** Produit affiché dans les camemberts de la section C. */
  produitProportionId: number | null = null;
  private propAvantChart: Chart | null = null;
  private propApresChart: Chart | null = null;
  progressionAnnee: number = new Date().getFullYear();
  progressionProgrammeId: number | null = null;
  loadingProgression = false;

  private msdChart: Chart | null = null;
  private ruptureChart: Chart | null = null;
  private proportionChart: Chart | null = null;
  private executionChart: Chart | null = null;
  private progressionChart: Chart | null = null;

  dsMsd = new MatTableDataSource<MsdEvolution>([]);
  dsRuptures = new MatTableDataSource<RuptureEvolution>([]);
  dsDisponibilites = new MatTableDataSource<DisponibiliteItem>([]);
  dsLignesPlan = new MatTableDataSource<LignePlan>([]);
  dsTop5 = new MatTableDataSource<any>([]);

  @ViewChild('pagMsd') pagMsd?: MatPaginator;
  @ViewChild('sortMsd') sortMsd?: MatSort;
  @ViewChild('pagRuptures') pagRuptures?: MatPaginator;
  @ViewChild('sortRuptures') sortRuptures?: MatSort;
  @ViewChild('pagDispo') pagDispo?: MatPaginator;
  @ViewChild('sortDispo') sortDispo?: MatSort;
  @ViewChild('pagLignes') pagLignes?: MatPaginator;
  @ViewChild('sortLignes') sortLignes?: MatSort;
  @ViewChild('pagTop5') pagTop5?: MatPaginator;
  @ViewChild('sortTop5') sortTop5?: MatSort;

  private snackBar = inject(MatSnackBar);
  private analysesService = inject(AnalysesService);

  /** Filtres du tableau de bord affiché (ceux du dernier « Analyser »). */
  charge = { periodeId: 0, programmeId: 0, planId: 0 };
  /** Indicateurs des dernières périodes, pour les courbes des cartes. */
  tendances: Tendance[] = [];
  private propBarresChart: Chart | null = null;

  get hauteurHalteres(): number {
    return Math.max(300, (this.data?.evolutionMsd.length ?? 0) * 24 + 90);
  }

  /** Produits ayant au moins un état de stock soumis (barres 100 %). */
  get proportionsSuivies(): ProportionStockage[] {
    return (this.data?.proportionsStockage ?? []).filter(p => p.nbSitesTotal > 0);
  }

  get hauteurBarresProportions(): number {
    return Math.max(220, this.proportionsSuivies.length * 52 + 70);
  }

  /** Points d'une courbe de tendance (110 × 26). */
  spark(cle: 'tauxDisponibilite' | 'tauxBienStocke' | 'indiceRisque'): string {
    return this.pointsSpark(cle).map(p => p.join(',')).join(' ');
  }

  dernierPoint(cle: 'tauxDisponibilite' | 'tauxBienStocke' | 'indiceRisque'): number[] {
    const pts = this.pointsSpark(cle);
    return pts[pts.length - 1] ?? [0, 0];
  }

  private pointsSpark(cle: 'tauxDisponibilite' | 'tauxBienStocke' | 'indiceRisque'): number[][] {
    const v = this.tendances.map(t => t[cle]);
    if (v.length < 2) return [];
    // Échelle fixe pour les taux (0–100) et l'indice (0–3) : une courbe plate reste plate
    const [min, max] = cle === 'indiceRisque' ? [0, 3] : [Math.min(...v, 50), 100];
    return v.map((y, i) => [
      Math.round((4 + i * 102 / (v.length - 1)) * 10) / 10,
      Math.round((23 - (y - min) / ((max - min) || 1) * 20) * 10) / 10
    ]);
  }

  infoTendance(cle: 'tauxDisponibilite' | 'tauxBienStocke' | 'indiceRisque', unite: string): string {
    const dec = cle === 'indiceRisque' ? 2 : 1;
    return 'Avant plan, par période : ' + this.tendances
      .map(t => `${t.periode} ${t[cle].toLocaleString('fr-FR', { maximumFractionDigits: dec })}${unite}`).join(' · ');
  }

  private chargerTendances(): void {
    this.tendances = [];
    const { periodeId, programmeId, planId } = this.charge;
    this.analysesService.tendances(periodeId, programmeId, planId).subscribe({
      next: (t) => this.tendances = t,
      error: () => this.tendances = []
    });
  }

  constructor(
    private tbService: TableauBordService,
    private periodeService: PeriodeService,
    private referentielService: ReferentielService,
    private planService: PlanService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadProgression();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.progressionChart) { this.progressionChart.destroy(); this.progressionChart = null; }
  }

  loadFilters(): void {
    const p$ = (this.auth.isAdmin() || this.auth.isSuperviseur())
      ? this.periodeService.getAllPeriodes()
      : this.periodeService.findByRegion();
    p$.subscribe({
      next: (periodes) => {
        // Admin et superviseur voient plusieurs régions : la date seule ne suffit pas à distinguer les périodes
        const plusieursRegions = new Set(periodes.map(p => p.regionId)).size > 1;
        this.periodOptions = periodes.map(p => ({
          label: (p.libelle ?? p.dateRas) + (plusieursRegions && p.regionNom ? ` · ${p.regionNom}` : ''),
          value: p.id,
          annee: p.dateRas ? Number(String(p.dateRas).slice(0, 4)) : (p as any).annee
        }));
        if (periodes.length > 0) {
          this.selectedPeriodId = periodes[0].id;
          this.suivreAnneeDeLaPeriode();
        }
      }
    });

    this.referentielService.getProgrammesGeres().subscribe({
      next: (progs) => {
        this.programmeOptions = progs
          .filter(p => p.active)
          .map(p => ({ label: p.nom, value: p.id }));
        if (progs.length > 0) this.selectedProgrammeId = progs[0].id;
        // La progression annuelle compare par défaut le programme sélectionné à l'ensemble des plans
        this.progressionProgrammeId = this.selectedProgrammeId;
        this.loadProgression();
      }
    });
  }

  /** La section H suit les choix faits en haut du tableau de bord. */
  onPeriodChange(): void {
    this.loadPlans();
    if (this.suivreAnneeDeLaPeriode()) this.loadProgression();
  }

  onProgrammeChange(): void {
    this.loadPlans();
    this.progressionProgrammeId = this.selectedProgrammeId;
    this.loadProgression();
  }

  /** Année de la période sélectionnée pour la progression annuelle ; vrai si elle a changé. */
  private suivreAnneeDeLaPeriode(): boolean {
    const annee = this.periodOptions.find(p => p.value === this.selectedPeriodId)?.annee;
    if (!annee || annee === this.progressionAnnee) return false;
    this.progressionAnnee = annee;
    return true;
  }

  loadPlans(): void {
    if (!this.selectedPeriodId) return;
    this.planService.getPlans(this.selectedPeriodId).subscribe({
      next: (plans) => {
        const filtered = this.selectedProgrammeId
          ? plans.filter(p => p.programmeId === this.selectedProgrammeId)
          : plans;
        this.plansListe = filtered;
        this.planOptions = filtered.map(p => ({
          label: `Plan #${p.id} · ${p.regionNom} · ${this.libelleStatutPlan(p.statut)} (${p.periodeLibelle})`,
          value: p.id
        }));
        this.selectedPlanId = filtered.length > 0 ? filtered[0].id : null;
      }
    });
  }

  /** Plans proposés dans la liste (pour identifier le plan affiché). */
  plansListe: PlanReattribution[] = [];

  /** Plan dont le tableau de bord est affiché : région, programme, validation. */
  get planAffiche(): PlanReattribution | null {
    return this.plansListe.find(p => p.id === this.charge.planId)
      ?? (this.planDetails?.id === this.charge.planId ? this.planDetails : null);
  }

  libelleStatutPlan(statut: string): string {
    const m: Record<string, string> = {
      BROUILLON: 'Brouillon', VALIDE: 'Validé', EN_COURS: 'En cours', EXECUTE: 'Exécuté', PARTIEL: 'Partiellement exécuté', CLOTURE: 'Clôturé', ANNULE: 'Annulé'
    };
    return m[statut] ?? statut;
  }

  /** Base du calcul « après » choisie par l'utilisateur (null : défaut selon le statut du plan). */
  baseApres: 'PREVUE' | 'EXECUTEE' | null = null;

  changerBase(base: 'PREVUE' | 'EXECUTEE'): void {
    if (this.data?.baseApres === base) return;
    this.baseApres = base;
    this.load(false);
  }

  load(nouveauPlan = true): void {
    if (!this.selectedPeriodId || !this.selectedProgrammeId || !this.selectedPlanId) return;
    // Nouvelle analyse : base par défaut (exécutée si le plan est validé)
    if (nouveauPlan) this.baseApres = null;
    this.loading = true;
    this.data = null;
    this.planDetails = null;
    this.charge = { periodeId: this.selectedPeriodId, programmeId: this.selectedProgrammeId, planId: this.selectedPlanId };
    if (nouveauPlan) this.chargerTendances();
    this.dsMsd.data = [];
    this.dsRuptures.data = [];
    this.dsDisponibilites.data = [];
    this.dsLignesPlan.data = [];
    this.dsTop5.data = [];
    this.destroyCharts();
    this.tbService.getTableauBord(
      this.selectedPeriodId,
      this.selectedProgrammeId,
      this.selectedPlanId,
      undefined,
      this.baseApres ?? undefined
    ).subscribe({
      next: (d) => {
        this.data = d;
        this.dsMsd.data = d.evolutionMsd;
        this.dsRuptures.data = d.evolutionRuptures;
        this.dsDisponibilites.data = d.disponibilites;
        this.dsTop5.data = d.analytique.top5Mouvements;
        // Produit par défaut : le premier qui a des états soumis
        const premier = d.proportionsStockage.find(p => p.nbSitesTotal > 0) ?? d.proportionsStockage[0];
        this.produitProportionId = premier?.produitId ?? null;
        this.loading = false;
        setTimeout(() => {
          this.dsMsd.paginator = this.pagMsd ?? null;
          this.dsMsd.sort = this.sortMsd ?? null;
          this.dsRuptures.paginator = this.pagRuptures ?? null;
          this.dsRuptures.sort = this.sortRuptures ?? null;
          this.dsDisponibilites.paginator = this.pagDispo ?? null;
          this.dsDisponibilites.sort = this.sortDispo ?? null;
          this.dsTop5.paginator = this.pagTop5 ?? null;
          this.dsTop5.sort = this.sortTop5 ?? null;
          this.buildCharts(d);
          this.buildProportionCharts();
          this.buildProgressionChart();
        }, 100);
        this.loadPlanDetails();
      },
      error: () => {
        this.snackBar.open('Impossible de charger le tableau de bord.', 'Fermer', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  loadPlanDetails(): void {
    if (!this.selectedPlanId) return;
    this.loadingLines = true;
    this.planService.getPlan(this.selectedPlanId).subscribe({
      next: (p) => {
        this.planDetails = p;
        this.dsLignesPlan.data = p.lignes ?? [];
        this.loadingLines = false;
        setTimeout(() => {
          this.dsLignesPlan.paginator = this.pagLignes ?? null;
          this.dsLignesPlan.sort = this.sortLignes ?? null;
          this.buildExecutionChart();
        }, 100);
      },
      error: () => { this.loadingLines = false; }
    });
  }

  loadProgression(): void {
    this.loadingProgression = true;
    if (this.progressionChart) { this.progressionChart.destroy(); this.progressionChart = null; }
    // Pas de région envoyée : le serveur applique lui-même le périmètre de l'utilisateur
    // (sa région, ses régions, ou toutes pour l'admin), même si la session est ancienne.
    const regionFilter = null;
    this.erreurProgression = '';
    const tous$ = this.planService.getExecutionProgression(this.progressionAnnee, regionFilter, null);
    const programme$ = this.progressionProgrammeId
      ? this.planService.getExecutionProgression(this.progressionAnnee, regionFilter, this.progressionProgrammeId)
      : of([] as ExecutionProgressionItem[]);
    forkJoin([tous$, programme$]).subscribe({
      next: ([tous, programme]) => {
        this.progressionItems = tous;
        this.progressionItemsProgramme = programme;
        this.loadingProgression = false;
        setTimeout(() => this.buildProgressionChart(), 100);
      },
      error: (err) => {
        this.loadingProgression = false;
        this.progressionItems = [];
        this.erreurProgression = err?.status === 403
          ? 'Accès refusé à ces données. Déconnectez-vous puis reconnectez-vous pour actualiser votre session.'
          : 'Impossible de charger la progression annuelle.';
      }
    });
  }

  /** Moyenne de progression par mois de l'année (pondérée par le nombre de plans), null si aucun plan. */
  private parMois(items: ExecutionProgressionItem[]): (number | null)[] {
    const somme = new Array(12).fill(0), poids = new Array(12).fill(0);
    for (const it of items) {
      const [mm, aaaa] = (it.periodeLabel ?? '').split('/');
      if (Number(aaaa) !== Number(this.progressionAnnee)) continue;
      const m = Number(mm) - 1;
      if (m < 0 || m > 11) continue;
      const n = it.nbPlans || 1;
      somme[m] += it.progressionMoyenne * n;
      poids[m] += n;
    }
    return somme.map((v, i) => poids[i] ? Math.round(v / poids[i] * 10) / 10 : null);
  }

  get proportionCourante(): ProportionStockage | undefined {
    return this.data?.proportionsStockage.find(p => p.produitId === this.produitProportionId);
  }

  /** Camemberts avant / après du produit choisi : Rupture, Tension, À surveiller, Bien stocké, Surstock. */
  buildProportionCharts(): void {
    if (this.propAvantChart) { this.propAvantChart.destroy(); this.propAvantChart = null; }
    if (this.propApresChart) { this.propApresChart.destroy(); this.propApresChart = null; }
    this.buildBarresProportions();
    const p = this.proportionCourante;
    if (!p) return;
    const libelles = ['Rupture', 'Tension', 'À surveiller', 'Bien stocké', 'Surstock'];
    const couleurs = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#a855f7'];
    const options: any = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#1e293b', boxWidth: 12 } },
        tooltip: { callbacks: { label: (ctx: any) => {
          const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0) || 1;
          return ` ${ctx.label} : ${ctx.raw} site(s), ${Math.round(ctx.raw / total * 100)} %`;
        } } }
      }
    };
    const avant = document.getElementById('propAvantChart') as HTMLCanvasElement;
    const apres = document.getElementById('propApresChart') as HTMLCanvasElement;
    if (avant) this.propAvantChart = new Chart(avant, { type: 'pie', options, data: { labels: libelles, datasets: [{
      data: [p.nbRuptureAvant, p.nbTensionAvant, p.nbSurveillerAvant, p.nbNormalAvant, p.nbSurstockAvant], backgroundColor: couleurs }] } });
    if (apres) this.propApresChart = new Chart(apres, { type: 'pie', options, data: { labels: libelles, datasets: [{
      data: [p.nbRuptureApres, p.nbTensionApres, p.nbSurveillerApres, p.nbNormalApres, p.nbSurstockApres], backgroundColor: couleurs }] } });
  }

  /** Barres empilées à 100 % : pour chaque produit, une barre avant et une barre après le plan. */
  private buildBarresProportions(): void {
    if (this.propBarresChart) { this.propBarresChart.destroy(); this.propBarresChart = null; }
    const canvas = document.getElementById('propBarresChart') as HTMLCanvasElement;
    const produits = this.proportionsSuivies;
    if (!canvas || !produits.length) return;
    const statuts: { libelle: string; couleur: string; avant: (p: ProportionStockage) => number; apres: (p: ProportionStockage) => number }[] = [
      { libelle: 'Rupture', couleur: '#ef4444', avant: p => p.nbRuptureAvant, apres: p => p.nbRuptureApres },
      { libelle: 'Tension', couleur: '#f97316', avant: p => p.nbTensionAvant, apres: p => p.nbTensionApres },
      { libelle: 'À surveiller', couleur: '#eab308', avant: p => p.nbSurveillerAvant, apres: p => p.nbSurveillerApres },
      { libelle: 'Bien stocké', couleur: '#22c55e', avant: p => p.nbNormalAvant, apres: p => p.nbNormalApres },
      { libelle: 'Surstock', couleur: '#a855f7', avant: p => p.nbSurstockAvant, apres: p => p.nbSurstockApres }
    ];
    // Deux lignes par produit : « avant » puis « après »
    const lignes = produits.flatMap(p => [{ p, moment: 'avant' as const }, { p, moment: 'apres' as const }]);
    const total = (p: ProportionStockage) => p.nbSitesTotal || 1;
    const nbSites = (s: typeof statuts[number], l: typeof lignes[number]) => l.moment === 'avant' ? s.avant(l.p) : s.apres(l.p);
    this.propBarresChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: lignes.map(l => l.moment === 'avant' ? [l.p.produitNom, 'avant'] : 'après') as any,
        datasets: statuts.map(s => ({
          label: s.libelle,
          data: lignes.map(l => Math.round(nbSites(s, l) / total(l.p) * 1000) / 10),
          backgroundColor: lignes.map(l => l.moment === 'avant' ? s.couleur + '99' : s.couleur),
          borderColor: '#fff', borderWidth: 1, barPercentage: 0.9, categoryPercentage: 0.85
        }))
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#1e293b', boxWidth: 12,
            generateLabels: () => statuts.map((s, i) => ({ text: s.libelle, fillStyle: s.couleur, strokeStyle: s.couleur, lineWidth: 0, datasetIndex: i, fontColor: '#1e293b' })) } },
          tooltip: { callbacks: {
            title: (it: any[]) => {
              const l = lignes[it[0].dataIndex];
              return `${l.p.produitNom}, ${l.moment === 'avant' ? 'avant' : 'après'} le plan`;
            },
            label: (c: any) => {
              const l = lignes[c.dataIndex];
              return ` ${c.dataset.label} : ${nbSites(statuts[c.datasetIndex], l)} site(s), ${c.raw.toLocaleString('fr-FR')} %`;
            }
          } }
        },
        scales: {
          x: { stacked: true, min: 0, max: 100, ticks: { color: '#64748b', callback: (v: any) => v + ' %' }, grid: { color: '#e2e8f0' } },
          y: { stacked: true, ticks: { color: '#1e293b', font: { size: 11 }, autoSkip: false }, grid: { display: false } }
        }
      } as any
    });
  }

  private buildExecutionChart(): void {
    if (this.executionChart) { this.executionChart.destroy(); this.executionChart = null; }
    const ctx = document.getElementById('executionChart') as HTMLCanvasElement;
    if (!ctx || !this.data) return;
    const pct = this.data.analytique.completudeExecution;
    this.executionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Exécuté', 'Restant'],
        datasets: [{ data: [pct, 100 - pct], backgroundColor: ['#22c55e', '#e2e8f0'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(1)}%` } } }
      }
    });
  }

  private buildProgressionChart(): void {
    if (this.progressionChart) { this.progressionChart.destroy(); this.progressionChart = null; }
    const ctx = document.getElementById('progressionChart') as HTMLCanvasElement;
    if (!ctx || this.progressionItems.length === 0) return;
    const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const datasets: any[] = [{
      label: 'Tous les plans',
      data: this.parMois(this.progressionItems),
      borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.08)',
      fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5', pointRadius: 4, spanGaps: true
    }];
    if (this.progressionProgrammeId) {
      const nom = this.programmeOptions.find(p => p.value === this.progressionProgrammeId)?.label ?? 'Programme';
      datasets.push({
        label: nom,
        data: this.parMois(this.progressionItemsProgramme),
        borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.08)', borderDash: [6, 4],
        fill: false, tension: 0.3, pointBackgroundColor: '#f97316', pointRadius: 4, spanGaps: true
      });
    }
    this.progressionChart = new Chart(ctx, {
      type: 'line',
      data: { labels: mois.map(m => `${m} ${this.progressionAnnee}`), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label} : ${(ctx.raw as number).toFixed(1)} %` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
          y: { min: 0, max: 100, ticks: { color: '#64748b', callback: (v) => v + '%' }, grid: { color: '#e2e8f0' } }
        }
      }
    });
  }

  private destroyCharts(): void {
    if (this.msdChart) { this.msdChart.destroy(); this.msdChart = null; }
    if (this.ruptureChart) { this.ruptureChart.destroy(); this.ruptureChart = null; }
    if (this.proportionChart) { this.proportionChart.destroy(); this.proportionChart = null; }
    if (this.executionChart) { this.executionChart.destroy(); this.executionChart = null; }
    if (this.propBarresChart) { this.propBarresChart.destroy(); this.propBarresChart = null; }
    if (this.propAvantChart) { this.propAvantChart.destroy(); this.propAvantChart = null; }
    if (this.propApresChart) { this.propApresChart.destroy(); this.propApresChart = null; }
  }

  /**
   * Les onglets ne créent leur contenu qu'à l'ouverture : graphiques et pagination des
   * tableaux sont donc (re)construits quand on ouvre l'onglet.
   */
  onOnglet(index: number): void {
    if (!this.data) return;
    setTimeout(() => {
      this.raccorderTableaux();
      if (index === 0 || index === 1) this.buildCharts(this.data!);
      if (index === 2) this.buildProportionCharts();
      if (index === 4) this.buildExecutionChart();
    });
  }

  private raccorderTableaux(): void {
    this.dsMsd.paginator = this.pagMsd ?? null;
    this.dsMsd.sort = this.sortMsd ?? null;
    this.dsRuptures.paginator = this.pagRuptures ?? null;
    this.dsRuptures.sort = this.sortRuptures ?? null;
    this.dsDisponibilites.paginator = this.pagDispo ?? null;
    this.dsDisponibilites.sort = this.sortDispo ?? null;
    this.dsLignesPlan.paginator = this.pagLignes ?? null;
    this.dsLignesPlan.sort = this.sortLignes ?? null;
    this.dsTop5.paginator = this.pagTop5 ?? null;
    this.dsTop5.sort = this.sortTop5 ?? null;
  }

  private buildCharts(d: TableauBordDTO): void {
    if (this.msdChart) { this.msdChart.destroy(); this.msdChart = null; }
    if (this.ruptureChart) { this.ruptureChart.destroy(); this.ruptureChart = null; }
    const gridColor = '#e2e8f0';
    const tickColor = '#64748b';
    const legendColor = '#1e293b';

    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: legendColor, font: { size: 12 } } },
        tooltip: { backgroundColor: '#ffffff', titleColor: '#1e293b', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1 }
      },
      scales: {
        x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
        y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } }
      }
    };

    // MSD : graphique en haltères (point avant → point après, relié par un trait)
    const msdCtx = document.getElementById('msdChart') as HTMLCanvasElement;
    if (msdCtx) {
      const lignes = [...d.evolutionMsd].sort((x, y) =>
        (x.produitNom ?? '').localeCompare(y.produitNom ?? '') || (y.deltaMsd - x.deltaMsd));
      const couleurDelta = (e: MsdEvolution) => e.deltaMsd > 0 ? '#16a34a' : (e.deltaMsd < 0 ? '#dc2626' : '#94a3b8');
      const seuil = d.analytique.seuilSecurite;
      this.msdChart = new Chart(msdCtx, {
        type: 'bar',
        data: {
          labels: lignes.map(e => `${e.produitCode} / ${e.structureNom}`),
          datasets: [
            { type: 'bar', label: 'Variation', data: lignes.map(e => [Math.min(e.msdAvant, e.msdApres), Math.max(e.msdAvant, e.msdApres)]) as any,
              backgroundColor: lignes.map(e => couleurDelta(e) + '99'), barThickness: 4, order: 3 },
            { type: 'line', label: 'MSD avant', data: lignes.map(e => e.msdAvant), showLine: false,
              pointRadius: 5, pointBackgroundColor: '#94a3b8', pointBorderColor: '#64748b', backgroundColor: '#94a3b8', borderColor: '#64748b', order: 2 },
            { type: 'line', label: 'MSD après le plan', data: lignes.map(e => e.msdApres), showLine: false,
              pointRadius: 6, pointBackgroundColor: lignes.map(couleurDelta), pointBorderColor: '#fff', pointBorderWidth: 1.5,
              backgroundColor: '#4f46e5', borderColor: '#4f46e5', order: 1 },
            { type: 'line', label: `Seuil de sécurité (${seuil} mois)`, data: lignes.map(() => seuil), borderColor: '#b45309',
              borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, order: 4 }
          ] as any
        },
        options: {
          ...baseOptions,
          indexAxis: 'y',
          interaction: { mode: 'index', axis: 'y', intersect: false },
          plugins: {
            ...baseOptions.plugins,
            title: { display: true, text: 'MSD avant → après le plan, par produit / site', color: legendColor },
            legend: { labels: { color: legendColor, font: { size: 12 }, usePointStyle: true, filter: (it: any) => it.text !== 'Variation' } },
            tooltip: { ...baseOptions.plugins.tooltip, filter: (it: any) => it.dataset.label !== 'Variation',
              callbacks: { label: (c: any) => ` ${c.dataset.label} : ${Number(c.raw).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} mois` } }
          },
          scales: {
            x: { ...baseOptions.scales.x, beginAtZero: true, title: { display: true, text: 'Mois de stock disponible', color: tickColor } },
            y: { ...baseOptions.scales.y, grid: { display: false } }
          }
        } as any
      });
    }

    // Rupture Chart
    const ruptureCtx = document.getElementById('ruptureChart') as HTMLCanvasElement;
    if (ruptureCtx) {
      this.ruptureChart = new Chart(ruptureCtx, {
        type: 'bar',
        data: {
          labels: d.evolutionRuptures.map(r => r.produitNom),
          datasets: [
            { label: 'Sites en rupture avant', data: d.evolutionRuptures.map(r => r.nbRupturesAvant), backgroundColor: 'rgba(239,68,68,0.75)', borderColor: '#ef4444', borderWidth: 1 },
            { label: 'Sites en rupture après le plan', data: d.evolutionRuptures.map(r => r.nbRupturesApres), backgroundColor: 'rgba(34,197,94,0.65)', borderColor: '#22c55e', borderWidth: 1 }
          ]
        },
        options: { ...baseOptions, plugins: { ...baseOptions.plugins, title: { display: true, text: 'Sites en rupture par produit, avant et après le plan', color: legendColor } } }
      });
    }
  }

  // Helpers
  deltaTrend(delta: number): string {
    if (delta > 0) return '#22c55e';
    if (delta < 0) return '#ef4444';
    return '#94a3b8';
  }

  deltaMatIcon(delta: number): string {
    if (delta > 0) return 'trending_up';
    if (delta < 0) return 'trending_down';
    return 'remove';
  }

  tendanceColor(tendance: string): string {
    if (tendance === 'GAIN' || tendance === 'AMELIORATION') return '#22c55e';
    if (tendance === 'PERTE' || tendance === 'DEGRADATION') return '#ef4444';
    return '#94a3b8';
  }

  tendanceMatIcon(tendance: string): string {
    if (tendance === 'GAIN' || tendance === 'AMELIORATION') return 'trending_up';
    if (tendance === 'PERTE' || tendance === 'DEGRADATION') return 'trending_down';
    return 'remove';
  }

  tendanceMatIconRupture(tendance: string): string {
    if (tendance === 'AMELIORATION') return 'trending_down';
    if (tendance === 'DEGRADATION') return 'trending_up';
    return 'remove';
  }

  kpiColor(taux: number): string {
    if (taux >= 80) return '#22c55e';
    if (taux >= 50) return '#f97316';
    return '#ef4444';
  }

  statutLigneBg(statut: string): string {
    const map: Record<string, string> = {
      'EXECUTE': 'rgba(34,197,94,.15)', 'PARTIEL': 'rgba(234,179,8,.15)',
      'EN_ATTENTE': 'rgba(100,116,139,.1)', 'ANNULE': 'rgba(239,68,68,.1)'
    };
    return map[statut] ?? 'rgba(100,116,139,.1)';
  }

  statutLigneColor(statut: string): string {
    const map: Record<string, string> = {
      'EXECUTE': '#15803d', 'PARTIEL': '#92400e',
      'EN_ATTENTE': '#475569', 'ANNULE': '#b91c1c'
    };
    return map[statut] ?? '#475569';
  }
}
