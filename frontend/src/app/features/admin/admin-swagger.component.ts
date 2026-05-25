import { Component, OnInit, AfterViewInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { AdminService } from '../../core/services/admin.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { PeriodeService } from '../../core/services/periode.service';
import { PlanService } from '../../core/services/plan.service';
import { StockService } from '../../core/services/stock.service';
import {
  Region, District, Structure, Programme, Produit,
  UtilisateurDTO, PeriodeSaisie, EtatStockSummary, PlanReattribution
} from '../../core/models/models';

@Component({
  selector: 'app-admin-swagger',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatTabsModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatButtonModule, MatIconModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDialogModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSlideToggleModule, MatChipsModule
  ],
  template: `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <h1>Administration — Base de données</h1>
        <p>Accès complet en lecture, création, modification et suppression sur toutes les entités</p>
      </div>
    </div>

    <mat-tab-group animationDuration="0ms">

      <!-- ══════════ RÉGIONS ══════════ -->
      <mat-tab label="Régions ({{ dsRegions.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fRegions (input)="dsRegions.filter=fRegions.value.trim().toLowerCase(); dsRegions.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('region')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsRegions" matSort #sortRegions="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let r">{{ r.id }}</td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th><td mat-cell *matCellDef="let r" style="font-weight:500;">{{ r.nom }}</td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let r" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('region', r)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('region', r.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','nom','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','nom','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="3" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagRegions [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ DISTRICTS ══════════ -->
      <mat-tab label="Districts ({{ dsDistricts.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fDistricts (input)="dsDistricts.filter=fDistricts.value.trim().toLowerCase(); dsDistricts.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('district')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsDistricts" matSort #sortDistricts="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let d">{{ d.id }}</td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>District</th><td mat-cell *matCellDef="let d" style="font-weight:500;">{{ d.nom }}</td></ng-container>
              <ng-container matColumnDef="region"><th mat-header-cell *matHeaderCellDef mat-sort-header>Région</th><td mat-cell *matCellDef="let d">{{ d.regionNom }}</td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let d" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('district', d)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('district', d.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','nom','region','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','nom','region','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagDistricts [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ STRUCTURES ══════════ -->
      <mat-tab label="Structures ({{ dsStructures.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fStructures (input)="dsStructures.filter=fStructures.value.trim().toLowerCase(); dsStructures.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('structure')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsStructures" matSort #sortStructures="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let s">{{ s.id }}</td></ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th><td mat-cell *matCellDef="let s"><code style="color:var(--accent-color);">{{ s.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th><td mat-cell *matCellDef="let s" style="font-weight:500;">{{ s.nom }}</td></ng-container>
              <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef mat-sort-header>Type</th><td mat-cell *matCellDef="let s" style="font-size:.8rem;">{{ s.type }}</td></ng-container>
              <ng-container matColumnDef="district"><th mat-header-cell *matHeaderCellDef mat-sort-header>District / Région</th><td mat-cell *matCellDef="let s" style="font-size:.8rem;">{{ s.districtNom }} · {{ s.regionNom }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let s"><span [class]="s.active ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ s.active ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let s" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('structure', s)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('structure', s.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','code','nom','type','district','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','code','nom','type','district','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagStructures [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ PROGRAMMES ══════════ -->
      <mat-tab label="Programmes ({{ dsProgrammes.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fProgrammes (input)="dsProgrammes.filter=fProgrammes.value.trim().toLowerCase(); dsProgrammes.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('programme')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsProgrammes" matSort #sortProgrammes="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let p">{{ p.id }}</td></ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th><td mat-cell *matCellDef="let p"><code style="color:var(--accent-color);">{{ p.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th><td mat-cell *matCellDef="let p" style="font-weight:500;">{{ p.nom }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let p"><span [class]="p.active ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ p.active ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('programme', p)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('programme', p.id)" matTooltip="Désactiver"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','code','nom','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','code','nom','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagProgrammes [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ PRODUITS ══════════ -->
      <mat-tab label="Produits ({{ dsProduits.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fProduits (input)="dsProduits.filter=fProduits.value.trim().toLowerCase(); dsProduits.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('produit')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsProduits" matSort #sortProduits="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let p">{{ p.id }}</td></ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th><td mat-cell *matCellDef="let p"><code style="color:var(--accent-color);">{{ p.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>Produit</th><td mat-cell *matCellDef="let p" style="font-weight:500;">{{ p.nom }}</td></ng-container>
              <ng-container matColumnDef="unite"><th mat-header-cell *matHeaderCellDef mat-sort-header>Unité</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.unite }}</td></ng-container>
              <ng-container matColumnDef="programme"><th mat-header-cell *matHeaderCellDef mat-sort-header>Programme</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.programmeCode }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let p"><span [class]="p.actif ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ p.actif ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('produit', p)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('produit', p.id)" matTooltip="Désactiver"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','code','nom','unite','programme','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','code','nom','unite','programme','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagProduits [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ UTILISATEURS ══════════ -->
      <mat-tab label="Utilisateurs ({{ dsUtilisateurs.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fUtilisateurs (input)="dsUtilisateurs.filter=fUtilisateurs.value.trim().toLowerCase(); dsUtilisateurs.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('utilisateur')"><mat-icon>person_add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsUtilisateurs" matSort #sortUtilisateurs="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let u">{{ u.id }}</td></ng-container>
              <ng-container matColumnDef="username"><th mat-header-cell *matHeaderCellDef mat-sort-header>Username</th><td mat-cell *matCellDef="let u" style="font-weight:600;">{{ u.username }}</td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th><td mat-cell *matCellDef="let u">{{ u.prenom }} {{ u.nom }}</td></ng-container>
              <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef mat-sort-header>Rôle</th><td mat-cell *matCellDef="let u"><span class="badge badge-ouverte" style="font-size:.65rem;">{{ u.roleNom }}</span></td></ng-container>
              <ng-container matColumnDef="perimetre"><th mat-header-cell *matHeaderCellDef mat-sort-header>Périmètre</th><td mat-cell *matCellDef="let u" style="font-size:.8rem;">{{ u.structureNom ?? u.regionNom ?? (u.supervisedRegionIds?.length ? u.supervisedRegionIds.length + ' région(s)' : '—') }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let u"><span [class]="u.actif ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ u.actif ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let u" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('utilisateur', u)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntity('utilisateur', u.id)" matTooltip="Désactiver" *ngIf="u.actif"><mat-icon>person_off</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','username','nom','role','perimetre','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','username','nom','role','perimetre','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagUtilisateurs [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ PÉRIODES ══════════ -->
      <mat-tab label="Périodes ({{ dsPeriodes.data.length }})">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="flex:1;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fPeriodes (input)="dsPeriodes.filter=fPeriodes.value.trim().toLowerCase(); dsPeriodes.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="openDialog('periode')"><mat-icon>add</mat-icon> Ajouter</button>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsPeriodes" matSort #sortPeriodes="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let p">{{ p.id }}</td></ng-container>
              <ng-container matColumnDef="libelle"><th mat-header-cell *matHeaderCellDef mat-sort-header>Date RAS</th><td mat-cell *matCellDef="let p" style="font-weight:500;">{{ p.libelle ?? p.dateRas }}</td></ng-container>
              <ng-container matColumnDef="region"><th mat-header-cell *matHeaderCellDef mat-sort-header>Région</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.regionNom ?? '—' }}</td></ng-container>
              <ng-container matColumnDef="statut"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let p"><span [class]="p.statut === 'OUVERTE' ? 'badge badge-ouverte' : 'badge badge-fermee'" style="font-size:.65rem;">{{ p.statut }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  <button mat-icon-button color="warn" (click)="deleteEntity('periode', p.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','libelle','region','statut','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','libelle','region','statut','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagPeriodes [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
        </div>
      </mat-tab>

      <!-- ══════════ ÉTATS DE STOCK ══════════ -->
      <mat-tab label="États de stock">
        <div style="padding:1rem 0;">
          <mat-card style="margin-bottom:1rem;">
            <mat-card-content style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;padding-top:.5rem;">
              <mat-form-field appearance="fill" style="min-width:200px;">
                <mat-label>Période</mat-label>
                <mat-select [(ngModel)]="etatsPeriodeId" (selectionChange)="loadEtats()">
                  <mat-option [value]="null">— Choisir —</mat-option>
                  <mat-option *ngFor="let p of dsPeriodes.data" [value]="p.id">{{ p.libelle ?? p.dateRas }}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field *ngIf="dsEtatsAdmin.data.length > 0" appearance="outline" style="flex:1;max-width:400px;">
                <mat-label>Filtrer</mat-label>
                <input matInput #fEtats (input)="dsEtatsAdmin.filter=fEtats.value.trim().toLowerCase(); dsEtatsAdmin.paginator?.firstPage()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </mat-card-content>
          </mat-card>
          <mat-card *ngIf="dsEtatsAdmin.data.length > 0" style="padding:0;">
            <table mat-table [dataSource]="dsEtatsAdmin" matSort #sortEtats="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let e">{{ e.id }}</td></ng-container>
              <ng-container matColumnDef="structure"><th mat-header-cell *matHeaderCellDef mat-sort-header>Structure</th><td mat-cell *matCellDef="let e" style="font-weight:500;">{{ e.structureNom }}</td></ng-container>
              <ng-container matColumnDef="programme"><th mat-header-cell *matHeaderCellDef mat-sort-header>Programme</th><td mat-cell *matCellDef="let e" style="font-size:.8rem;">{{ e.programmeNom }}</td></ng-container>
              <ng-container matColumnDef="statut"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let e"><span [style.background]="e.statut === 'SUBMITTED' ? '#dcfce7' : '#fef9c3'" [style.color]="e.statut === 'SUBMITTED' ? '#15803d' : '#92400e'" style="padding:.2rem .5rem;border-radius:999px;font-size:.7rem;font-weight:700;">{{ e.statut }}</span></td></ng-container>
              <ng-container matColumnDef="lignes"><th mat-header-cell *matHeaderCellDef mat-sort-header>Lignes</th><td mat-cell *matCellDef="let e" style="font-size:.8rem;">{{ e.nbLignesSaved }} / {{ e.nbLignes }}</td></ng-container>
              <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef mat-sort-header>Créé le</th><td mat-cell *matCellDef="let e" style="font-size:.75rem;color:var(--text-secondary);">{{ e.dateCreation | date:'dd/MM/yyyy' }}</td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let e" style="text-align:right;">
                  <button mat-icon-button color="warn" (click)="deleteEntity('etat', e.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','structure','programme','statut','lignes','date','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','structure','programme','statut','lignes','date','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagEtats [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
          <div *ngIf="!etatsPeriodeId" style="text-align:center;padding:2rem;color:var(--text-secondary);">Sélectionnez une période pour afficher les états</div>
          <div *ngIf="etatsPeriodeId && dsEtatsAdmin.data.length === 0" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun état pour cette période</div>
        </div>
      </mat-tab>

      <!-- ══════════ PLANS ══════════ -->
      <mat-tab label="Plans ({{ dsPlans.data.length }})">
        <div style="padding:1rem 0;">
          <div style="margin-bottom:.75rem;">
            <mat-form-field appearance="outline" style="width:100%;max-width:400px;">
              <mat-label>Rechercher</mat-label>
              <input matInput #fPlans (input)="dsPlans.filter=fPlans.value.trim().toLowerCase(); dsPlans.paginator?.firstPage()">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="dsPlans" matSort #sortPlans="matSort" style="width:100%;">
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef mat-sort-header>#</th><td mat-cell *matCellDef="let p">{{ p.id }}</td></ng-container>
              <ng-container matColumnDef="periode"><th mat-header-cell *matHeaderCellDef mat-sort-header>Période</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.periodeLibelle }}</td></ng-container>
              <ng-container matColumnDef="programme"><th mat-header-cell *matHeaderCellDef mat-sort-header>Programme</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.programmeNom }}</td></ng-container>
              <ng-container matColumnDef="region"><th mat-header-cell *matHeaderCellDef mat-sort-header>Région</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.regionNom }}</td></ng-container>
              <ng-container matColumnDef="statut"><th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th><td mat-cell *matCellDef="let p"><span class="badge" style="font-size:.65rem;">{{ p.statut }}</span></td></ng-container>
              <ng-container matColumnDef="lignes"><th mat-header-cell *matHeaderCellDef mat-sort-header>Progression</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.nbLignesExecutees }}/{{ p.nbLignes }}</td></ng-container>
              <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef mat-sort-header>Généré le</th><td mat-cell *matCellDef="let p" style="font-size:.75rem;color:var(--text-secondary);">{{ p.dateGeneration | date:'dd/MM/yyyy' }}</td></ng-container>
              <tr mat-header-row *matHeaderRowDef="['id','periode','programme','region','statut','lignes','date']"></tr>
              <tr mat-row *matRowDef="let r; columns:['id','periode','programme','region','statut','lignes','date'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
            <mat-paginator #pagPlans [pageSizeOptions]="[10,25,50]" showFirstLastButtons></mat-paginator>
          </mat-card>
          <div *ngIf="dsPlans.data.length === 0" style="text-align:center;padding:2rem;color:var(--text-secondary);">Aucun plan</div>
        </div>
      </mat-tab>

    </mat-tab-group>

    <!-- ══════════ DIALOG ÉDITION ══════════ -->
    <ng-template #editDialog>
      <h2 mat-dialog-title>{{ dialogTitle }}</h2>
      <mat-dialog-content style="min-width:400px;padding-top:.5rem;">

        <!-- Région -->
        <ng-container *ngIf="dialogType === 'region'">
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Nom de la région</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
        </ng-container>

        <!-- District -->
        <ng-container *ngIf="dialogType === 'district'">
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Nom du district</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Région</mat-label>
            <mat-select [(ngModel)]="form['regionId']" required>
              <mat-option *ngFor="let r of dsRegions.data" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Structure -->
        <ng-container *ngIf="dialogType === 'structure'">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.5rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Code</mat-label>
              <input matInput [(ngModel)]="form['code']" required>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="form['type']">
                <mat-option value="HOPITAL">Hôpital</mat-option>
                <mat-option value="CENTRE_SANTE">Centre de Santé</mat-option>
                <mat-option value="DISPENSAIRE">Dispensaire</mat-option>
                <mat-option value="DEPOT">Dépôt</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Nom</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>District</mat-label>
            <mat-select [(ngModel)]="form['districtId']" required>
              <mat-option *ngFor="let d of dsDistricts.data" [value]="d.id">{{ d.nom }} ({{ d.regionNom }})</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Programme -->
        <ng-container *ngIf="dialogType === 'programme'">
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Code</mat-label>
            <input matInput [(ngModel)]="form['code']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Nom</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Description</mat-label>
            <textarea matInput [(ngModel)]="form['description']" rows="2"></textarea>
          </mat-form-field>
        </ng-container>

        <!-- Produit -->
        <ng-container *ngIf="dialogType === 'produit'">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.5rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Code</mat-label>
              <input matInput [(ngModel)]="form['code']" required>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Unité</mat-label>
              <input matInput [(ngModel)]="form['unite']" required>
            </mat-form-field>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Nom du produit</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Programme</mat-label>
            <mat-select [(ngModel)]="form['programmeId']" required>
              <mat-option *ngFor="let p of dsProgrammes.data" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Utilisateur -->
        <ng-container *ngIf="dialogType === 'utilisateur'">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.5rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="form['username']" required [disabled]="!!form['id']">
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>{{ form['id'] ? 'Nouveau mdp (optionnel)' : 'Mot de passe' }}</mat-label>
              <input matInput type="password" [(ngModel)]="form['password']" [required]="!form['id']">
            </mat-form-field>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.5rem;">
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Prénom</mat-label>
              <input matInput [(ngModel)]="form['prenom']">
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Nom</mat-label>
              <input matInput [(ngModel)]="form['nom']">
            </mat-form-field>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="form['email']">
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Rôle</mat-label>
            <mat-select [(ngModel)]="form['roleId']" required>
              <mat-option *ngFor="let r of roles" [value]="r.id">{{ r.name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;" *ngIf="formRoleName() === 'GESTIONNAIRE'">
            <mat-label>Structure</mat-label>
            <mat-select [(ngModel)]="form['structureId']">
              <mat-option [value]="null">— Aucune —</mat-option>
              <mat-option *ngFor="let s of dsStructures.data" [value]="s.id">{{ s.code }} — {{ s.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;" *ngIf="formRoleName() === 'PHARMACIEN_REGION'">
            <mat-label>Région</mat-label>
            <mat-select [(ngModel)]="form['regionId']">
              <mat-option [value]="null">— Aucune —</mat-option>
              <mat-option *ngFor="let r of dsRegions.data" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
          <ng-container *ngIf="formRoleName() === 'SUPERVISEUR'">
            <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
              <mat-label>Régions supervisées</mat-label>
              <mat-select [(ngModel)]="form['supervisedRegionIds']" multiple>
                <mat-option *ngFor="let r of dsRegions.data" [value]="r.id">{{ r.nom }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
              <mat-label>Districts supervisés</mat-label>
              <mat-select [(ngModel)]="form['supervisedDistrictIds']" multiple>
                <mat-option *ngFor="let d of dsDistricts.data" [value]="d.id">{{ d.nom }} ({{ d.regionNom }})</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:100%;">
              <mat-label>Sites supervisés</mat-label>
              <mat-select [(ngModel)]="form['supervisedStructureIds']" multiple>
                <mat-option *ngFor="let s of dsStructures.data" [value]="s.id">{{ s.code }} — {{ s.nom }}</mat-option>
              </mat-select>
            </mat-form-field>
          </ng-container>
        </ng-container>

        <!-- Période -->
        <ng-container *ngIf="dialogType === 'periode'">
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Date RAS (yyyy-MM-dd)</mat-label>
            <input matInput [(ngModel)]="form['dateRas']" placeholder="2026-05-15" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Région</mat-label>
            <mat-select [(ngModel)]="form['regionId']" required>
              <mat-option *ngFor="let r of dsRegions.data" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Annuler</button>
        <button mat-raised-button color="primary" (click)="saveDialog()" [disabled]="saving">
          <mat-spinner *ngIf="saving" diameter="18" style="display:inline-block;margin-right:.4rem;"></mat-spinner>
          {{ form['id'] ? 'Mettre à jour' : 'Créer' }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `
})
export class AdminSwaggerComponent implements OnInit, AfterViewInit {
  dsRegions = new MatTableDataSource<Region>([]);
  dsDistricts = new MatTableDataSource<District>([]);
  dsStructures = new MatTableDataSource<Structure>([]);
  dsProgrammes = new MatTableDataSource<Programme>([]);
  dsProduits = new MatTableDataSource<Produit>([]);
  dsUtilisateurs = new MatTableDataSource<UtilisateurDTO>([]);
  dsPeriodes = new MatTableDataSource<PeriodeSaisie>([]);
  dsEtatsAdmin = new MatTableDataSource<EtatStockSummary>([]);
  dsPlans = new MatTableDataSource<PlanReattribution>([]);

  roles: { id: number; name: string }[] = [];
  etatsPeriodeId: number | null = null;

  dialogType = '';
  dialogTitle = '';
  form: Record<string, any> = {};
  saving = false;

  @ViewChild('editDialog') editDialogRef!: TemplateRef<any>;
  @ViewChild('pagRegions') pagRegions!: MatPaginator;
  @ViewChild('pagDistricts') pagDistricts!: MatPaginator;
  @ViewChild('pagStructures') pagStructures!: MatPaginator;
  @ViewChild('pagProgrammes') pagProgrammes!: MatPaginator;
  @ViewChild('pagProduits') pagProduits!: MatPaginator;
  @ViewChild('pagUtilisateurs') pagUtilisateurs!: MatPaginator;
  @ViewChild('pagPeriodes') pagPeriodes!: MatPaginator;
  @ViewChild('pagEtats') pagEtats!: MatPaginator;
  @ViewChild('pagPlans') pagPlans!: MatPaginator;
  @ViewChild('sortRegions') sortRegions!: MatSort;
  @ViewChild('sortDistricts') sortDistricts!: MatSort;
  @ViewChild('sortStructures') sortStructures!: MatSort;
  @ViewChild('sortProgrammes') sortProgrammes!: MatSort;
  @ViewChild('sortProduits') sortProduits!: MatSort;
  @ViewChild('sortUtilisateurs') sortUtilisateurs!: MatSort;
  @ViewChild('sortPeriodes') sortPeriodes!: MatSort;
  @ViewChild('sortEtats') sortEtats!: MatSort;
  @ViewChild('sortPlans') sortPlans!: MatSort;

  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  constructor(
    private adminService: AdminService,
    private refService: ReferentielService,
    private periodeService: PeriodeService,
    private planService: PlanService,
    private stockService: StockService
  ) {}

  ngOnInit(): void { this.loadAll(); }

  ngAfterViewInit(): void {
    this.dsRegions.paginator = this.pagRegions;
    this.dsRegions.sort = this.sortRegions;
    this.dsDistricts.paginator = this.pagDistricts;
    this.dsDistricts.sort = this.sortDistricts;
    this.dsStructures.paginator = this.pagStructures;
    this.dsStructures.sort = this.sortStructures;
    this.dsProgrammes.paginator = this.pagProgrammes;
    this.dsProgrammes.sort = this.sortProgrammes;
    this.dsProduits.paginator = this.pagProduits;
    this.dsProduits.sort = this.sortProduits;
    this.dsUtilisateurs.paginator = this.pagUtilisateurs;
    this.dsUtilisateurs.sort = this.sortUtilisateurs;
    this.dsPeriodes.paginator = this.pagPeriodes;
    this.dsPeriodes.sort = this.sortPeriodes;
    this.dsEtatsAdmin.paginator = this.pagEtats;
    this.dsEtatsAdmin.sort = this.sortEtats;
    this.dsPlans.paginator = this.pagPlans;
    this.dsPlans.sort = this.sortPlans;
  }

  loadAll(): void {
    this.refService.getRegions().subscribe(d => this.dsRegions.data = d);
    this.refService.getDistricts().subscribe(d => this.dsDistricts.data = d);
    this.refService.getStructures().subscribe(d => this.dsStructures.data = d);
    this.refService.getProgrammes().subscribe(d => this.dsProgrammes.data = d);
    this.refService.getProduits().subscribe(d => this.dsProduits.data = d);
    this.adminService.getUtilisateurs().subscribe(d => this.dsUtilisateurs.data = d);
    this.adminService.getRoles().subscribe(d => this.roles = d);
    this.periodeService.getAllPeriodes().subscribe(d => this.dsPeriodes.data = d);
    this.planService.getPlans().subscribe(d => this.dsPlans.data = d);
  }

  loadEtats(): void {
    if (!this.etatsPeriodeId) return;
    this.stockService.listEtats(this.etatsPeriodeId, null, null).subscribe(d => this.dsEtatsAdmin.data = d);
  }

  openDialog(type: string, item?: any): void {
    this.dialogType = type;
    this.dialogTitle = item ? `Modifier — ${type}` : `Nouveau — ${type}`;
    this.form = item ? { ...item } : { supervisedRegionIds: [], supervisedDistrictIds: [], supervisedStructureIds: [] };
    this.dialog.open(this.editDialogRef, { width: '600px', disableClose: false });
  }

  saveDialog(): void {
    this.saving = true;
    let obs$: any;
    const f = this.form;

    switch (this.dialogType) {
      case 'region':
        obs$ = f['id'] ? this.adminService.updateRegion(f['id'], f['nom']) : this.adminService.createRegion(f['nom']);
        break;
      case 'district':
        obs$ = f['id'] ? this.adminService.updateDistrict(f['id'], f['nom'], f['regionId']) : this.adminService.createDistrict(f['nom'], f['regionId']);
        break;
      case 'structure':
        obs$ = f['id'] ? this.adminService.updateStructure(f['id'], f as any) : this.adminService.createStructure(f as any);
        break;
      case 'programme':
        obs$ = f['id'] ? this.adminService.updateProgramme(f['id'], f) : this.adminService.createProgramme(f);
        break;
      case 'produit':
        obs$ = f['id'] ? this.adminService.updateProduit(f['id'], f as any) : this.adminService.createProduit(f as any);
        break;
      case 'utilisateur':
        obs$ = f['id'] ? this.adminService.updateUtilisateur(f['id'], f) : this.adminService.createUtilisateur(f);
        break;
      case 'periode':
        obs$ = this.adminService.createPeriode(f['dateRas'], f['regionId']);
        break;
      default: this.saving = false; return;
    }

    obs$.subscribe({
      next: () => {
        this.saving = false;
        this.dialog.closeAll();
        this.snackBar.open('Sauvegardé avec succès.', 'OK', { duration: 2500 });
        this.loadAll();
      },
      error: (err: any) => {
        this.saving = false;
        this.snackBar.open(err.error?.message || 'Erreur.', 'Fermer', { duration: 4000 });
      }
    });
  }

  deleteEntity(type: string, id: number): void {
    if (!confirm(`Supprimer cet élément ? Cette action est irréversible.`)) return;
    let obs$: any;
    switch (type) {
      case 'region': obs$ = this.adminService.deleteRegion(id); break;
      case 'district': obs$ = this.adminService.deleteDistrict(id); break;
      case 'structure': obs$ = this.adminService.deleteStructure(id); break;
      case 'programme': obs$ = this.adminService.deleteProgramme(id); break;
      case 'produit': obs$ = this.adminService.deleteProduit(id); break;
      case 'utilisateur': obs$ = this.adminService.deleteUtilisateur(id); break;
      case 'periode': obs$ = this.adminService.deletePeriodeAdmin(id); break;
      case 'etat': obs$ = this.stockService.deleteEtat(id); break;
      default: return;
    }
    obs$.subscribe({
      next: () => {
        this.snackBar.open('Supprimé.', 'OK', { duration: 2000 });
        this.loadAll();
        if (type === 'etat') this.loadEtats();
      },
      error: (err: any) => this.snackBar.open(err.error?.message || 'Erreur.', 'Fermer', { duration: 4000 })
    });
  }

  formRoleName(): string {
    const r = this.roles.find(r => r.id === this.form['roleId']);
    return r?.name ?? '';
  }
}
