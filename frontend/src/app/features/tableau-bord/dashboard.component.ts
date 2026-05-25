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
import { TableauBordService } from '../../core/services/tableau-bord.service';
import { PeriodeService } from '../../core/services/periode.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { PlanService } from '../../core/services/plan.service';
import { AuthService } from '../../core/auth/auth.service';
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
    MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule
  ],
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
        </div>

        <!-- Indice de risque -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Indice de risque</div>
          <div style="display:flex; align-items:flex-end; gap:.75rem;">
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Avant</div>
              <div style="font-size:1.4rem;font-weight:700;color:#ef4444;">{{ data.analytique.indiceRisqueAvant | number:'1.0-0' }}</div>
            </div>
            <div style="color:var(--text-secondary);padding-bottom:6px;">→</div>
            <div>
              <div style="font-size:.75rem;color:var(--text-secondary);">Après</div>
              <div style="font-size:1.4rem;font-weight:700;" [style.color]="deltaTrend(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres)">
                {{ data.analytique.indiceRisqueApres | number:'1.0-0' }}
              </div>
            </div>
          </div>
          <div class="stat-delta" [style.color]="deltaTrend(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres)" style="margin-top:.5rem;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">{{ deltaMatIcon(data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres) }}</mat-icon>
            {{ (data.analytique.indiceRisqueAvant - data.analytique.indiceRisqueApres) | number:'1.0-0' }} pts
            <span style="color:var(--text-secondary);font-size:.75rem;margin-left:.25rem;">(↓ = mieux)</span>
          </div>
        </div>

        <!-- Score d'impact -->
        <div class="stat-card">
          <div class="stat-label" style="text-transform:uppercase;font-size:.68rem;font-weight:700;letter-spacing:.06em;margin-bottom:.75rem;">Score d'impact global</div>
          <div style="font-size:2.5rem;font-weight:800;color:var(--accent-color);line-height:1;">
            {{ data.analytique.scoreImpactGlobal | number:'1.0-0' }}
          </div>
          <div style="margin-top:.75rem;display:flex;gap:.75rem;font-size:.8rem;">
            <span style="color:#22c55e;"><mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">trending_up</mat-icon> {{ data.analytique.nbSitesAmeliores }} améliorés</span>
            <span style="color:#ef4444;"><mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">trending_down</mat-icon> {{ data.analytique.nbSitesDegrades }} dégradés</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group animationDuration="200ms">

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
            <div class="chart-container" style="margin-bottom:1.5rem;">
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
                  <span [class]="'badge badge-' + item.statutAvant.toLowerCase()">{{ item.statutAvant }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="statutApres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut après</th>
                <td mat-cell *matCellDef="let item">
                  <span [class]="'badge badge-' + item.statutApres.toLowerCase()">{{ item.statutApres }}</span>
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
            <div class="chart-container" style="margin-bottom:1.5rem;">
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
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:center;">Avant</th>
                <td mat-cell *matCellDef="let item" style="text-align:center;color:#ef4444;font-weight:600;">{{ item.nbRupturesAvant }}</td>
              </ng-container>
              <ng-container matColumnDef="apres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header style="text-align:center;">Après</th>
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
            <mat-icon style="margin-right:.4rem;">stacked_bar_chart</mat-icon> Proportions
          </ng-template>
          <div style="padding:1rem 0;">
            <div class="section-title">
              <mat-icon style="color:#f97316;">stacked_bar_chart</mat-icon>
              C. Proportions de stockage (100%)
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem;font-size:.75rem;">
              <div style="display:flex;align-items:center;gap:.3rem;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#ef4444;"></span> Rupture</div>
              <div style="display:flex;align-items:center;gap:.3rem;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#f97316;"></span> Tension</div>
              <div style="display:flex;align-items:center;gap:.3rem;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#eab308;"></span> À surveiller</div>
              <div style="display:flex;align-items:center;gap:.3rem;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#22c55e;"></span> Normal</div>
              <div style="display:flex;align-items:center;gap:.3rem;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#a855f7;"></span> Surstock</div>
            </div>
            <div class="chart-container">
              <canvas id="proportionChart"></canvas>
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
              <ng-container matColumnDef="dispoAvant">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Disponibilité avant</th>
                <td mat-cell *matCellDef="let item">
                  <div style="display:flex;align-items:center;gap:.5rem;">
                    <mat-progress-bar mode="determinate" [value]="item.tauxDispoAvant" style="width:120px;" color="accent"></mat-progress-bar>
                    <span style="font-size:.8rem;font-family:monospace;min-width:40px;">{{ item.tauxDispoAvant | number:'1.0-0' }}%</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="dispoApres">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Disponibilité après plan</th>
                <td mat-cell *matCellDef="let item">
                  <div style="display:flex;align-items:center;gap:.5rem;">
                    <mat-progress-bar mode="determinate" [value]="item.tauxDispoApres" style="width:120px;" color="primary"></mat-progress-bar>
                    <span style="font-size:.8rem;font-family:monospace;min-width:40px;font-weight:600;" [style.color]="deltaTrend(item.deltaDispo)">
                      {{ item.tauxDispoApres | number:'1.0-0' }}%
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
              <tr mat-header-row *matHeaderRowDef="['produit','dispoAvant','dispoApres','delta','tendance']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['produit','dispoAvant','dispoApres','delta','tendance'];"></tr>
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
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:1.5rem;flex-wrap:wrap;">
              <!-- Métriques -->
              <div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:1rem;">Indicateurs composites</div>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Couverture programme avant</span>
                    <span style="font-weight:700;font-family:monospace;">{{ data.analytique.tauxCouvertureProgrammeAvant | number:'1.1-1' }}%</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Couverture programme après</span>
                    <span style="font-weight:700;font-family:monospace;" [style.color]="deltaTrend(data.analytique.tauxCouvertureProgrammeApres - data.analytique.tauxCouvertureProgrammeAvant)">
                      {{ data.analytique.tauxCouvertureProgrammeApres | number:'1.1-1' }}%
                    </span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;background:#f8fafc;border-radius:.375rem;border:1px solid var(--border-color);">
                    <span style="font-size:.8rem;color:var(--text-secondary);">Complétude d'exécution</span>
                    <span style="font-weight:700;font-family:monospace;" [style.color]="kpiColor(data.analytique.completudeExecution)">
                      {{ data.analytique.completudeExecution | number:'1.1-1' }}%
                    </span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.25rem;">
                    <div style="padding:.75rem;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:.375rem;text-align:center;">
                      <div style="font-size:1.5rem;font-weight:800;color:#22c55e;">{{ data.analytique.nbSitesAmeliores }}</div>
                      <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;">Sites améliorés</div>
                    </div>
                    <div style="padding:.75rem;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:.375rem;text-align:center;">
                      <div style="font-size:1.5rem;font-weight:800;color:#ef4444;">{{ data.analytique.nbSitesDegrades }}</div>
                      <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;">Sites dégradés</div>
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
      <mat-card style="margin-bottom:1.25rem;">
        <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
          <mat-form-field appearance="fill" style="width:120px;">
            <mat-label>Année</mat-label>
            <input matInput type="number" [(ngModel)]="progressionAnnee" [min]="2020" [max]="2099">
          </mat-form-field>
          <mat-form-field appearance="fill" style="min-width:180px;">
            <mat-label>Programme</mat-label>
            <mat-select [(ngModel)]="progressionProgrammeId">
              <mat-option [value]="null">Tous les programmes</mat-option>
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
          <div *ngIf="progressionItems.length === 0" style="text-align:center;padding:2rem;color:var(--text-secondary);font-size:.875rem;">
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

  periodOptions: { label: string; value: number }[] = [];
  programmeOptions: { label: string; value: number }[] = [];
  planOptions: { label: string; value: number }[] = [];

  selectedPeriodId: number | null = null;
  selectedProgrammeId: number | null = null;
  selectedPlanId: number | null = null;

  planDetails: PlanReattribution | null = null;
  loadingLines = false;

  progressionItems: ExecutionProgressionItem[] = [];
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
  }

  loadFilters(): void {
    const p$ = (this.auth.isAdmin() || this.auth.isSuperviseur())
      ? this.periodeService.getAllPeriodes()
      : this.periodeService.findByRegion();
    p$.subscribe({
      next: (periodes) => {
        this.periodOptions = periodes.map(p => ({
          label: p.libelle ?? p.dateRas,
          value: p.id
        }));
        if (periodes.length > 0) this.selectedPeriodId = periodes[0].id;
      }
    });

    this.referentielService.getProgrammes().subscribe({
      next: (progs) => {
        this.programmeOptions = progs
          .filter(p => p.active)
          .map(p => ({ label: p.nom, value: p.id }));
        if (progs.length > 0) this.selectedProgrammeId = progs[0].id;
      }
    });
  }

  onPeriodChange(): void {
    this.loadPlans();
  }

  onProgrammeChange(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    if (!this.selectedPeriodId) return;
    this.planService.getPlans(this.selectedPeriodId).subscribe({
      next: (plans) => {
        const filtered = this.selectedProgrammeId
          ? plans.filter(p => p.programmeId === this.selectedProgrammeId)
          : plans;
        this.planOptions = filtered.map(p => ({
          label: `Plan #${p.id} — ${p.statut} (${p.periodeLibelle})`,
          value: p.id
        }));
        this.selectedPlanId = filtered.length > 0 ? filtered[0].id : null;
      }
    });
  }

  load(): void {
    if (!this.selectedPeriodId || !this.selectedProgrammeId || !this.selectedPlanId) return;
    this.loading = true;
    this.data = null;
    this.planDetails = null;
    this.dsMsd.data = [];
    this.dsRuptures.data = [];
    this.dsDisponibilites.data = [];
    this.dsLignesPlan.data = [];
    this.dsTop5.data = [];
    this.destroyCharts();
    this.tbService.getTableauBord(
      this.selectedPeriodId,
      this.selectedProgrammeId,
      this.selectedPlanId
    ).subscribe({
      next: (d) => {
        this.data = d;
        this.dsMsd.data = d.evolutionMsd;
        this.dsRuptures.data = d.evolutionRuptures;
        this.dsDisponibilites.data = d.disponibilites;
        this.dsTop5.data = d.analytique.top5Mouvements;
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
    const regionFilter = (this.auth.isAdmin() || this.auth.isSuperviseur()) ? null : this.auth.regionId;
    this.planService.getExecutionProgression(this.progressionAnnee, regionFilter, this.progressionProgrammeId).subscribe({
      next: (items) => {
        this.progressionItems = items;
        this.loadingProgression = false;
        setTimeout(() => this.buildProgressionChart(), 100);
      },
      error: () => { this.loadingProgression = false; }
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
    this.progressionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.progressionItems.map(i => i.periodeLabel),
        datasets: [{
          label: 'Progression moyenne (%)',
          data: this.progressionItems.map(i => i.progressionMoyenne),
          borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.1)',
          fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(1)}%` } }
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
    if (this.progressionChart) { this.progressionChart.destroy(); this.progressionChart = null; }
  }

  private buildCharts(d: TableauBordDTO): void {
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

    // MSD Chart
    const msdCtx = document.getElementById('msdChart') as HTMLCanvasElement;
    if (msdCtx) {
      this.msdChart = new Chart(msdCtx, {
        type: 'bar',
        data: {
          labels: d.evolutionMsd.map(e => `${e.produitCode} / ${e.structureNom}`),
          datasets: [
            { label: 'MSD Avant', data: d.evolutionMsd.map(e => e.msdAvant), backgroundColor: 'rgba(145,153,169,0.7)', borderColor: '#94a3b8', borderWidth: 1 },
            { label: 'MSD Après plan', data: d.evolutionMsd.map(e => e.msdApres), backgroundColor: 'rgba(129,140,248,0.7)', borderColor: '#818cf8', borderWidth: 1 }
          ]
        },
        options: { ...baseOptions, plugins: { ...baseOptions.plugins, title: { display: true, text: 'Évolution MSD par produit/site', color: legendColor } } }
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
            { label: 'Ruptures Avant', data: d.evolutionRuptures.map(r => r.nbRupturesAvant), backgroundColor: 'rgba(239,68,68,0.75)', borderColor: '#ef4444', borderWidth: 1 },
            { label: 'Ruptures Après plan', data: d.evolutionRuptures.map(r => r.nbRupturesApres), backgroundColor: 'rgba(34,197,94,0.65)', borderColor: '#22c55e', borderWidth: 1 }
          ]
        },
        options: { ...baseOptions, plugins: { ...baseOptions.plugins, title: { display: true, text: 'Nombre de ruptures par produit', color: legendColor } } }
      });
    }

    // Proportion stacked Chart
    const propCtx = document.getElementById('proportionChart') as HTMLCanvasElement;
    if (propCtx) {
      const propLabels: string[] = [];
      const rupAvant: number[] = [], rupApres: number[] = [];
      const tensAvant: number[] = [], tensApres: number[] = [];
      const survAvant: number[] = [], survApres: number[] = [];
      const normAvant: number[] = [], normApres: number[] = [];
      const surAvant: number[] = [], surApres: number[] = [];

      d.proportionsStockage.forEach(p => {
        propLabels.push(`${p.produitNom} ↑`, `${p.produitNom} ↓`);
        rupAvant.push(p.nbRuptureAvant); tensAvant.push(p.nbTensionAvant);
        survAvant.push(p.nbSurveillerAvant); normAvant.push(p.nbNormalAvant); surAvant.push(p.nbSurstockAvant);
        rupApres.push(p.nbRuptureApres); tensApres.push(p.nbTensionApres);
        survApres.push(p.nbSurveillerApres); normApres.push(p.nbNormalApres); surApres.push(p.nbSurstockApres);
      });

      const interleave = (avant: number[], apres: number[]): number[] => {
        const result: number[] = [];
        for (let i = 0; i < avant.length; i++) { result.push(avant[i], apres[i]); }
        return result;
      };

      this.proportionChart = new Chart(propCtx, {
        type: 'bar',
        data: {
          labels: propLabels,
          datasets: [
            { label: 'Rupture', data: interleave(rupAvant, rupApres), backgroundColor: '#ef4444', stack: 'a' },
            { label: 'Tension', data: interleave(tensAvant, tensApres), backgroundColor: '#f97316', stack: 'a' },
            { label: 'À surveiller', data: interleave(survAvant, survApres), backgroundColor: '#eab308', stack: 'a' },
            { label: 'Normal', data: interleave(normAvant, normApres), backgroundColor: '#22c55e', stack: 'a' },
            { label: 'Surstock', data: interleave(surAvant, surApres), backgroundColor: '#a855f7', stack: 'a' }
          ]
        },
        options: {
          ...baseOptions,
          plugins: { ...baseOptions.plugins, title: { display: true, text: 'Proportions de stockage (sites avant / après)', color: legendColor } },
          scales: {
            x: { ...baseOptions.scales.x, stacked: true },
            y: { ...baseOptions.scales.y, stacked: true }
          }
        }
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
