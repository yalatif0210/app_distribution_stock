import { Component, OnInit, AfterViewInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
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
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReferentielService } from '../../core/services/referentiel.service';
import { AdminService } from '../../core/services/admin.service';
import { Region, District, Structure, Programme, Produit, UtilisateurDTO, ImportResult } from '../../core/models/models';

@Component({
  selector: 'app-referentiel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTabsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSlideToggleModule,
    MatPaginatorModule, MatCheckboxModule
  ],
  template: `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
      <div>
        <h1>Administration — Référentiel</h1>
        <p>Gérez les données de référence de l'application</p>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;">
          <button mat-stroked-button (click)="geoInput.click()" [disabled]="importingGeo">
            <mat-icon>upload_file</mat-icon>
            {{ importingGeo ? 'Import en cours…' : 'Import Géo (Excel)' }}
          </button>
          <span style="font-size:.7rem;color:var(--text-secondary);"><code>région&nbsp;|&nbsp;district&nbsp;|&nbsp;structure&nbsp;|&nbsp;code*&nbsp;|&nbsp;type*</code></span>
          <span style="font-size:.65rem;color:var(--text-secondary);">* optionnel — types&nbsp;:&nbsp;HOPITAL, CENTRE_SANTE, DISPENSAIRE, DEPOT</span>
        </div>
        <input #geoInput type="file" accept=".xlsx,.xls" hidden (change)="onGeoFile($event)">

        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;">
          <button mat-stroked-button (click)="catalogueInput.click()" [disabled]="importingCatalogue">
            <mat-icon>upload_file</mat-icon>
            {{ importingCatalogue ? 'Import en cours…' : 'Import Catalogue (Excel)' }}
          </button>
          <span style="font-size:.7rem;color:var(--text-secondary);"><code>programme&nbsp;|&nbsp;code_prog*&nbsp;|&nbsp;produit&nbsp;|&nbsp;code_prod*&nbsp;|&nbsp;unité*</code></span>
          <span style="font-size:.65rem;color:var(--text-secondary);">* optionnel — auto-généré si absent</span>
        </div>
        <input #catalogueInput type="file" accept=".xlsx,.xls" hidden (change)="onCatalogueFile($event)">
      </div>
    </div>

    <mat-tab-group animationDuration="0ms">

      <!-- ══════════ RÉGIONS ══════════ -->
      <mat-tab label="Régions">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(regionsDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selReg.hasValue()" (click)="deleteSelected('region', selReg)">
                <mat-icon>delete</mat-icon> Supprimer ({{ selReg.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('region')"><mat-icon>add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="regionsDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selReg, regionsDS)"
                    [checked]="isAllSelected(selReg, regionsDS)"
                    [indeterminate]="selReg.hasValue() && !isAllSelected(selReg, regionsDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let r" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selReg.toggle(r)" [checked]="selReg.isSelected(r)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef>#</th><td mat-cell *matCellDef="let r">{{ r.id }}</td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>Nom</th><td mat-cell *matCellDef="let r" style="font-weight:500;">{{ r.nom }}</td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let r" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('region', r)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteItem('region', r.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','id','nom','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','id','nom','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="4" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgReg [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

      <!-- ══════════ DISTRICTS ══════════ -->
      <mat-tab label="Districts">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(districtsDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selDist.hasValue()" (click)="deleteSelected('district', selDist)">
                <mat-icon>delete</mat-icon> Supprimer ({{ selDist.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('district')"><mat-icon>add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="districtsDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selDist, districtsDS)"
                    [checked]="isAllSelected(selDist, districtsDS)"
                    [indeterminate]="selDist.hasValue() && !isAllSelected(selDist, districtsDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let d" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selDist.toggle(d)" [checked]="selDist.isSelected(d)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>District</th><td mat-cell *matCellDef="let d" style="font-weight:500;">{{ d.nom }}</td></ng-container>
              <ng-container matColumnDef="region"><th mat-header-cell *matHeaderCellDef>Région</th><td mat-cell *matCellDef="let d">{{ d.regionNom }}</td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let d" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('district', d)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteItem('district', d.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','nom','region','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','nom','region','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="4" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgDist [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

      <!-- ══════════ STRUCTURES ══════════ -->
      <mat-tab label="Structures">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(structuresDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selStr.hasValue()" (click)="deleteSelected('structure', selStr)">
                <mat-icon>delete</mat-icon> Supprimer ({{ selStr.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('structure')"><mat-icon>add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="structuresDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selStr, structuresDS)"
                    [checked]="isAllSelected(selStr, structuresDS)"
                    [indeterminate]="selStr.hasValue() && !isAllSelected(selStr, structuresDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let s" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selStr.toggle(s)" [checked]="selStr.isSelected(s)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Code</th><td mat-cell *matCellDef="let s"><code style="color:var(--accent-color);font-size:.78rem;">{{ s.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>Nom</th><td mat-cell *matCellDef="let s" style="font-weight:500;">{{ s.nom }}</td></ng-container>
              <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let s">{{ s.type }}</td></ng-container>
              <ng-container matColumnDef="district"><th mat-header-cell *matHeaderCellDef>District</th><td mat-cell *matCellDef="let s">{{ s.districtNom }}</td></ng-container>
              <ng-container matColumnDef="actif">
                <th mat-header-cell *matHeaderCellDef>Actif</th>
                <td mat-cell *matCellDef="let s"><span [class]="s.active ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ s.active ? 'Actif' : 'Inactif' }}</span></td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let s" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('structure', s)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','code','nom','type','district','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','code','nom','type','district','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgStr [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

      <!-- ══════════ PROGRAMMES ══════════ -->
      <mat-tab label="Programmes">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(programmesDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selProg.hasValue()" (click)="deleteSelected('programme', selProg)">
                <mat-icon>delete</mat-icon> Supprimer ({{ selProg.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('programme')"><mat-icon>add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="programmesDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selProg, programmesDS)"
                    [checked]="isAllSelected(selProg, programmesDS)"
                    [indeterminate]="selProg.hasValue() && !isAllSelected(selProg, programmesDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let p" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selProg.toggle(p)" [checked]="selProg.isSelected(p)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Code</th><td mat-cell *matCellDef="let p"><code style="color:var(--accent-color);font-size:.78rem;">{{ p.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>Nom</th><td mat-cell *matCellDef="let p" style="font-weight:500;">{{ p.nom }}</td></ng-container>
              <ng-container matColumnDef="description"><th mat-header-cell *matHeaderCellDef>Description</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;color:var(--text-secondary);">{{ p.description }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef>Actif</th><td mat-cell *matCellDef="let p"><span [class]="p.active ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ p.active ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('programme', p)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteItem('programme', p.id)" matTooltip="Désactiver"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','code','nom','description','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','code','nom','description','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="6" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgProg [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

      <!-- ══════════ PRODUITS ══════════ -->
      <mat-tab label="Produits">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(produitsDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selProd.hasValue()" (click)="deleteSelected('produit', selProd)">
                <mat-icon>delete</mat-icon> Supprimer ({{ selProd.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('produit')"><mat-icon>add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="produitsDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selProd, produitsDS)"
                    [checked]="isAllSelected(selProd, produitsDS)"
                    [indeterminate]="selProd.hasValue() && !isAllSelected(selProd, produitsDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let p" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selProd.toggle(p)" [checked]="selProd.isSelected(p)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Code</th><td mat-cell *matCellDef="let p"><code style="color:var(--accent-color);font-size:.78rem;">{{ p.code }}</code></td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>Produit</th><td mat-cell *matCellDef="let p" style="font-weight:500;">{{ p.nom }}</td></ng-container>
              <ng-container matColumnDef="unite"><th mat-header-cell *matHeaderCellDef>Unité</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.unite }}</td></ng-container>
              <ng-container matColumnDef="programme"><th mat-header-cell *matHeaderCellDef>Programme</th><td mat-cell *matCellDef="let p" style="font-size:.8rem;">{{ p.programmeCode }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef>Actif</th><td mat-cell *matCellDef="let p"><span [class]="p.actif ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ p.actif ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('produit', p)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteItem('produit', p.id)" matTooltip="Désactiver"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','code','nom','unite','programme','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','code','nom','unite','programme','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgProd [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

      <!-- ══════════ UTILISATEURS ══════════ -->
      <mat-tab label="Utilisateurs">
        <div style="padding:1rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap;">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="min-width:200px;flex:1;max-width:300px;">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Filtrer…" (input)="applyFilter(utilisateursDS, $event)">
            </mat-form-field>
            <div style="display:flex;gap:.5rem;">
              <button mat-stroked-button color="warn" *ngIf="selUser.hasValue()" (click)="deleteSelected('utilisateur', selUser)">
                <mat-icon>person_off</mat-icon> Désactiver ({{ selUser.selected.length }})
              </button>
              <button mat-raised-button color="primary" (click)="openDialog('utilisateur')"><mat-icon>person_add</mat-icon> Ajouter</button>
            </div>
          </div>
          <mat-card style="padding:0;">
            <table mat-table [dataSource]="utilisateursDS" style="width:100%;">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width:48px;">
                  <mat-checkbox (change)="toggleAll(selUser, utilisateursDS)"
                    [checked]="isAllSelected(selUser, utilisateursDS)"
                    [indeterminate]="selUser.hasValue() && !isAllSelected(selUser, utilisateursDS)"></mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let u" style="width:48px;">
                  <mat-checkbox (click)="$event.stopPropagation()" (change)="selUser.toggle(u)" [checked]="selUser.isSelected(u)"></mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="username"><th mat-header-cell *matHeaderCellDef>Username</th><td mat-cell *matCellDef="let u" style="font-weight:600;">{{ u.username }}</td></ng-container>
              <ng-container matColumnDef="nom"><th mat-header-cell *matHeaderCellDef>Nom</th><td mat-cell *matCellDef="let u">{{ u.prenom }} {{ u.nom }}</td></ng-container>
              <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>Rôle</th><td mat-cell *matCellDef="let u"><span class="badge badge-ouverte" style="font-size:.65rem;">{{ u.roleNom }}</span></td></ng-container>
              <ng-container matColumnDef="perimetre"><th mat-header-cell *matHeaderCellDef>Périmètre</th><td mat-cell *matCellDef="let u" style="font-size:.8rem;">{{ u.structureNom ?? u.regionNom ?? '—' }}</td></ng-container>
              <ng-container matColumnDef="actif"><th mat-header-cell *matHeaderCellDef>Actif</th><td mat-cell *matCellDef="let u"><span [class]="u.actif ? 'badge badge-normal' : 'badge badge-fermee'" style="font-size:.65rem;">{{ u.actif ? 'Actif' : 'Inactif' }}</span></td></ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let u" style="text-align:right;">
                  <button mat-icon-button color="primary" (click)="openDialog('utilisateur', u)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteItem('utilisateur', u.id)" matTooltip="Désactiver" *ngIf="u.actif"><mat-icon>person_off</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['select','username','nom','role','perimetre','actif','actions']"></tr>
              <tr mat-row *matRowDef="let r; columns:['select','username','nom','role','perimetre','actif','actions'];"></tr>
              <tr class="mat-row" *matNoDataRow><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--text-secondary);">Aucun résultat</td></tr>
            </table>
          </mat-card>
          <mat-paginator #pgUser [pageSizeOptions]="[10,25,50]" pageSize="10" showFirstLastButtons></mat-paginator>
        </div>
      </mat-tab>

    </mat-tab-group>

    <!-- ══════════ DIALOG ÉDITION ══════════ -->
    <ng-template #editDialog>
      <h2 mat-dialog-title>{{ dialogTitle }}</h2>
      <mat-dialog-content style="min-width:380px;padding-top:.5rem;">

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
              <mat-option *ngFor="let r of regionsDS.data" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Structure -->
        <ng-container *ngIf="dialogType === 'structure'">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
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
              <mat-option *ngFor="let d of districtsDS.data" [value]="d.id">{{ d.nom }} ({{ d.regionNom }})</mat-option>
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
              <input matInput [(ngModel)]="form['unite']" required placeholder="comprimé, flacon…">
            </mat-form-field>
          </div>
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Nom du produit</mat-label>
            <input matInput [(ngModel)]="form['nom']" required>
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%;">
            <mat-label>Programme</mat-label>
            <mat-select [(ngModel)]="form['programmeId']" required>
              <mat-option *ngFor="let p of programmesDS.data" [value]="p.id">{{ p.code }} — {{ p.nom }}</mat-option>
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
              <mat-label>{{ form['id'] ? 'Nouveau mdp (laisser vide)' : 'Mot de passe' }}</mat-label>
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
          <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
            <mat-label>Régions couvertes</mat-label>
            <mat-select [(ngModel)]="form['supervisedRegionIds']" multiple (ngModelChange)="onRegionChange($event)">
              <mat-option [value]="0" style="font-style:italic;color:var(--accent-color);">— Toutes les régions —</mat-option>
              <mat-option *ngFor="let r of regionsDS.data" [value]="r.id">{{ r.nom }}</mat-option>
            </mat-select>
          </mat-form-field>
          <ng-container *ngIf="(form['supervisedRegionIds'] ?? []).length > 0">
            <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
              <mat-label>Districts couverts</mat-label>
              <mat-select [(ngModel)]="form['supervisedDistrictIds']" multiple (ngModelChange)="onDistrictChange($event)">
                <mat-option [value]="0" style="font-style:italic;color:var(--accent-color);">— Tous les districts —</mat-option>
                <mat-option *ngFor="let d of filteredDistricts" [value]="d.id">{{ d.nom }}</mat-option>
              </mat-select>
            </mat-form-field>
          </ng-container>
          <ng-container *ngIf="(form['supervisedDistrictIds'] ?? []).length > 0">
            <mat-form-field appearance="fill" style="width:100%;margin-bottom:.5rem;">
              <mat-label>Sites couverts</mat-label>
              <mat-select [(ngModel)]="form['supervisedStructureIds']" multiple (ngModelChange)="onStructureChange($event)">
                <mat-option [value]="0" style="font-style:italic;color:var(--accent-color);">— Tous les sites —</mat-option>
                <mat-option *ngFor="let s of filteredStructures" [value]="s.id">{{ s.code }} — {{ s.nom }}</mat-option>
              </mat-select>
            </mat-form-field>
          </ng-container>
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
export class ReferentielComponent implements OnInit, AfterViewInit {

  // Data sources
  regionsDS      = new MatTableDataSource<Region>();
  districtsDS    = new MatTableDataSource<District>();
  structuresDS   = new MatTableDataSource<Structure>();
  programmesDS   = new MatTableDataSource<Programme>();
  produitsDS     = new MatTableDataSource<Produit>();
  utilisateursDS = new MatTableDataSource<UtilisateurDTO>();

  // Selections
  selReg  = new SelectionModel<Region>(true, []);
  selDist = new SelectionModel<District>(true, []);
  selStr  = new SelectionModel<Structure>(true, []);
  selProg = new SelectionModel<Programme>(true, []);
  selProd = new SelectionModel<Produit>(true, []);
  selUser = new SelectionModel<UtilisateurDTO>(true, []);

  // Paginators
  @ViewChild('pgReg')  pgReg!:  MatPaginator;
  @ViewChild('pgDist') pgDist!: MatPaginator;
  @ViewChild('pgStr')  pgStr!:  MatPaginator;
  @ViewChild('pgProg') pgProg!: MatPaginator;
  @ViewChild('pgProd') pgProd!: MatPaginator;
  @ViewChild('pgUser') pgUser!: MatPaginator;

  roles: { id: number; name: string }[] = [];
  dialogType = '';
  dialogTitle = '';
  form: Record<string, any> = {};
  saving = false;
  importingGeo = false;
  importingCatalogue = false;

  @ViewChild('editDialog') editDialogRef!: TemplateRef<any>;

  private dialog   = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  constructor(
    private refService: ReferentielService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void { this.loadAll(); }

  ngAfterViewInit(): void {
    this.regionsDS.paginator      = this.pgReg;
    this.districtsDS.paginator    = this.pgDist;
    this.structuresDS.paginator   = this.pgStr;
    this.programmesDS.paginator   = this.pgProg;
    this.produitsDS.paginator     = this.pgProd;
    this.utilisateursDS.paginator = this.pgUser;
  }

  loadAll(): void {
    this.refService.getRegions().subscribe(d    => { this.regionsDS.data      = d; this.selReg.clear();  });
    this.refService.getDistricts().subscribe(d  => { this.districtsDS.data    = d; this.selDist.clear(); });
    this.refService.getStructures().subscribe(d => { this.structuresDS.data   = d; this.selStr.clear();  });
    this.refService.getProgrammes().subscribe(d => { this.programmesDS.data   = d; this.selProg.clear(); });
    this.refService.getProduits().subscribe(d   => { this.produitsDS.data     = d; this.selProd.clear(); });
    this.adminService.getUtilisateurs().subscribe(d => { this.utilisateursDS.data = d; this.selUser.clear(); });
    this.adminService.getRoles().subscribe(d    => this.roles = d);
  }

  applyFilter(ds: MatTableDataSource<any>, event: Event): void {
    ds.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    if (ds.paginator) ds.paginator.firstPage();
  }

  isAllSelected(sel: SelectionModel<any>, ds: MatTableDataSource<any>): boolean {
    return sel.selected.length === ds.filteredData.length && ds.filteredData.length > 0;
  }

  toggleAll(sel: SelectionModel<any>, ds: MatTableDataSource<any>): void {
    this.isAllSelected(sel, ds) ? sel.clear() : ds.filteredData.forEach(r => sel.select(r));
  }

  deleteSelected(type: string, sel: SelectionModel<any>): void {
    const count = sel.selected.length;
    if (!confirm(`Supprimer ${count} élément(s) sélectionné(s) ?`)) return;
    const obs$ = sel.selected.map((item: any) =>
      this.deleteObs(type, item.id).pipe(catchError(() => of(null)))
    );
    forkJoin(obs$).subscribe(() => {
      this.snackBar.open(`${count} élément(s) traité(s).`, 'OK', { duration: 2500 });
      sel.clear();
      this.loadAll();
    });
  }

  private deleteObs(type: string, id: number): Observable<any> {
    switch (type) {
      case 'region':      return this.adminService.deleteRegion(id);
      case 'district':    return this.adminService.deleteDistrict(id);
      case 'structure':   return this.adminService.deleteStructure(id);
      case 'programme':   return this.adminService.deleteProgramme(id);
      case 'produit':     return this.adminService.deleteProduit(id);
      case 'utilisateur': return this.adminService.deleteUtilisateur(id);
      default:            return of(null);
    }
  }

  openDialog(type: string, item?: any): void {
    this.dialogType  = type;
    this.dialogTitle = item ? `Modifier — ${type}` : `Nouveau — ${type}`;
    if (type === 'utilisateur') {
      this.form = {
        supervisedRegionIds: [],
        supervisedDistrictIds: [],
        supervisedStructureIds: [],
        ...(item ?? {})
      };
    } else {
      this.form = item ? { ...item } : {};
    }
    this.dialog.open(this.editDialogRef, { width: '560px', disableClose: false });
  }

  saveDialog(): void {
    this.saving = true;
    const f = this.form;
    let obs$: Observable<any>;

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
      case 'utilisateur': {
        const payload: any = { ...f };
        const roleName = this.roleName();
        // Dériver les champs legacy pour que le contrôle d'accès backend fonctionne
        if (roleName === 'GESTIONNAIRE') {
          payload['structureId'] = (f['supervisedStructureIds'] as number[])?.[0] ?? null;
        } else if (roleName === 'PHARMACIEN_REGION') {
          payload['regionId'] = (f['supervisedRegionIds'] as number[])?.[0] ?? null;
        }
        obs$ = f['id'] ? this.adminService.updateUtilisateur(f['id'], payload) : this.adminService.createUtilisateur(payload);
        break;
      }
      default:
        this.saving = false;
        return;
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
        this.snackBar.open(err.error?.message || 'Erreur lors de la sauvegarde.', 'Fermer', { duration: 4000 });
      }
    });
  }

  deleteItem(type: string, id: number): void {
    this.deleteObs(type, id).subscribe({
      next: () => { this.snackBar.open('Supprimé.', 'OK', { duration: 2000 }); this.loadAll(); },
      error: (err: any) => this.snackBar.open(err.error?.message || 'Erreur.', 'Fermer', { duration: 4000 })
    });
  }

  onGeoFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importingGeo = true;
    this.refService.importGeo(file).subscribe({
      next: (r: ImportResult) => {
        this.importingGeo = false;
        (event.target as HTMLInputElement).value = '';
        this.snackBar.open(`Import Géo : ${r.created} créé(s), ${r.updated} mis à jour, ${r.errors} erreur(s).`, 'OK', { duration: 6000 });
        if (r.errors === 0) this.loadAll();
      },
      error: (err: any) => {
        this.importingGeo = false;
        (event.target as HTMLInputElement).value = '';
        this.snackBar.open(err.error?.message || 'Erreur lors de l\'import géo.', 'Fermer', { duration: 5000 });
      }
    });
  }

  onCatalogueFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importingCatalogue = true;
    this.refService.importCatalogue(file).subscribe({
      next: (r: ImportResult) => {
        this.importingCatalogue = false;
        (event.target as HTMLInputElement).value = '';
        this.snackBar.open(`Import Catalogue : ${r.created} créé(s), ${r.updated} mis à jour, ${r.errors} erreur(s).`, 'OK', { duration: 6000 });
        if (r.errors === 0) this.loadAll();
      },
      error: (err: any) => {
        this.importingCatalogue = false;
        (event.target as HTMLInputElement).value = '';
        this.snackBar.open(err.error?.message || 'Erreur lors de l\'import catalogue.', 'Fermer', { duration: 5000 });
      }
    });
  }

  get filteredDistricts(): District[] {
    const sel: number[] = this.form['supervisedRegionIds'] ?? [];
    return this.districtsDS.data.filter(d => sel.includes(d.regionId));
  }

  get filteredStructures(): Structure[] {
    const sel: number[] = this.form['supervisedDistrictIds'] ?? [];
    return this.structuresDS.data.filter(s => sel.includes(s.districtId));
  }

  onRegionChange(val: number[]): void {
    const regions: number[] = val.includes(0)
      ? this.regionsDS.data.map(r => r.id)
      : val.filter(v => v !== 0);

    // Différer pour laisser le cycle de détection de changements compléter d'abord
    setTimeout(() => {
      this.form['supervisedRegionIds'] = regions;

      const validDistrictIds = new Set(
        this.districtsDS.data.filter(d => regions.includes(d.regionId)).map(d => d.id)
      );
      this.form['supervisedDistrictIds'] =
        ((this.form['supervisedDistrictIds'] as number[]) ?? []).filter(id => validDistrictIds.has(id));

      const selDistricts: number[] = this.form['supervisedDistrictIds'];
      const validStructureIds = new Set(
        this.structuresDS.data.filter(s => selDistricts.includes(s.districtId)).map(s => s.id)
      );
      this.form['supervisedStructureIds'] =
        ((this.form['supervisedStructureIds'] as number[]) ?? []).filter(id => validStructureIds.has(id));
    });
  }

  onDistrictChange(val: number[]): void {
    const districts: number[] = val.includes(0)
      ? this.filteredDistricts.map(d => d.id)
      : val.filter(v => v !== 0);

    setTimeout(() => {
      this.form['supervisedDistrictIds'] = districts;

      const validStructureIds = new Set(
        this.structuresDS.data.filter(s => districts.includes(s.districtId)).map(s => s.id)
      );
      this.form['supervisedStructureIds'] =
        ((this.form['supervisedStructureIds'] as number[]) ?? []).filter(id => validStructureIds.has(id));
    });
  }

  onStructureChange(val: number[]): void {
    if (!val.includes(0)) return;
    const all = this.filteredStructures.map(s => s.id);
    setTimeout(() => { this.form['supervisedStructureIds'] = all; });
  }

  private roleName(): string | undefined {
    return this.roles.find(r => r.id === this.form['roleId'])?.name;
  }
}
