import { Component, OnInit, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/auth/auth.service';
import { NotificationService } from '../core/services/notification.service';

interface NavItem {
  label: string;
  icon: string;
  routerLink: string;
}

interface NavGroup {
  label: string;
  icon: string;
  directLink?: string;   // si groupe = lien direct (pas de dropdown)
  items?: NavItem[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  styles: [`
    .nav-group-btn.open { color: var(--accent-color); background: rgba(79,70,229,.07); }
    .nav-dropdown { animation: dropIn .15s ease; }
    @keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
    .nav-chevron { transition: transform .2s ease; }
    .nav-chevron.open { transform: rotate(180deg); }
    .topbar-context-label { font-size:.7rem; color:var(--accent-color); font-weight:500; margin-top:.05rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
  `],
  template: `
    <div class="layout-wrapper">

      <!-- ── Topbar ── -->
      <header class="layout-topbar">

        <!-- Brand -->
        <a routerLink="/" class="topbar-brand">
          <div class="topbar-brand-icon"><mat-icon>inventory_2</mat-icon></div>
          <div>
            <div class="topbar-brand-text">Redistribution</div>
            <div class="topbar-brand-sub">Stocks sanitaires</div>
          </div>
        </a>

        <!-- Navigation avec dropdowns -->
        <nav class="topbar-nav">
          <ng-container *ngFor="let group of navGroups">

            <!-- Lien direct (pas de sous-menu) -->
            <a *ngIf="group.directLink"
               class="nav-direct"
               [routerLink]="group.directLink"
               routerLinkActive="active">
              <mat-icon>{{ group.icon }}</mat-icon>
              {{ group.label }}
            </a>

            <!-- Groupe avec dropdown -->
            <div *ngIf="!group.directLink" class="nav-group">
              <button class="nav-group-btn"
                      [class.open]="openGroup === group.label"
                      (click)="toggleGroup(group.label)">
                <mat-icon>{{ group.icon }}</mat-icon>
                {{ group.label }}
                <mat-icon class="nav-chevron" [class.open]="openGroup === group.label">expand_more</mat-icon>
              </button>
              <div class="nav-dropdown" *ngIf="openGroup === group.label">
                <a *ngFor="let item of group.items"
                   class="nav-dropdown-item"
                   [routerLink]="item.routerLink"
                   routerLinkActive="active"
                   (click)="openGroup = null">
                  <mat-icon>{{ item.icon }}</mat-icon>
                  {{ item.label }}
                </a>
              </div>
            </div>

          </ng-container>
        </nav>

        <!-- Droite : notifs + user + logout -->
        <div class="topbar-right">
          <a routerLink="/notifications" mat-icon-button style="position:relative;color:var(--text-secondary);" matTooltip="Notifications">
            <mat-icon>notifications_none</mat-icon>
            <ng-container *ngIf="(notifService.count$ | async) as c">
              <span *ngIf="c > 0" class="notif-badge">{{ c > 99 ? '99+' : c }}</span>
            </ng-container>
          </a>
          <div class="topbar-divider"></div>
          <div class="topbar-user-block">
            <div class="topbar-avatar">{{ initial }}</div>
            <div>
              <div class="topbar-username">{{ auth.currentUser?.username }}</div>
              <div class="topbar-role-label">{{ roleLabel }}</div>
              <div *ngIf="auth.contextLabel" class="topbar-context-label">{{ auth.contextLabel }}</div>
            </div>
          </div>
          <button mat-icon-button (click)="auth.logout()" matTooltip="Déconnexion" style="color:var(--text-secondary);">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </header>

      <!-- Contenu -->
      <main class="layout-page">
        <router-outlet />
      </main>

    </div>
  `
})
export class LayoutComponent implements OnInit {
  navGroups: NavGroup[] = [];
  openGroup: string | null = null;

  constructor(public auth: AuthService, public notifService: NotificationService) {}

  ngOnInit(): void {
    this.notifService.refreshCount();
    this.buildNav();
  }

  toggleGroup(label: string): void {
    this.openGroup = this.openGroup === label ? null : label;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('.nav-group')) {
      this.openGroup = null;
    }
  }

  get initial(): string {
    return (this.auth.currentUser?.username ?? 'U').charAt(0).toUpperCase();
  }

  get roleLabel(): string {
    switch (this.auth.role) {
      case 'ADMIN': return 'Administrateur';
      case 'PHARMACIEN_REGION': return 'Pharmacien région';
      case 'GESTIONNAIRE': return 'Gestionnaire';
      case 'SUPERVISEUR': return 'Superviseur';
      default: return this.auth.role ?? '';
    }
  }

  private buildNav(): void {
    const role = this.auth.role;

    if (role === 'GESTIONNAIRE') {
      this.navGroups = [
        {
          label: 'Stocks', icon: 'inventory_2',
          items: [
            { label: 'Sélection des produits gérés', icon: 'checklist',   routerLink: '/stocks/selection-produits' },
            { label: 'Saisie de stock',               icon: 'edit_note',  routerLink: '/stocks/saisie' },
            { label: 'Import Excel',                  icon: 'upload_file', routerLink: '/stocks/import' },
            { label: 'Historique',                    icon: 'history',    routerLink: '/stocks/tableau-bord' },
          ]
        },
        {
          label: 'Plans', icon: 'fact_check',
          items: [
            { label: 'Suivi des plans', icon: 'list_alt', routerLink: '/plans/suivi' },
          ]
        }
      ];
    } else if (role === 'PHARMACIEN_REGION') {
      this.navGroups = [
        {
          label: 'Tableau de bord', icon: 'dashboard',
          directLink: '/tableau-bord'
        },
        {
          label: 'Saisies', icon: 'assignment',
          items: [
            { label: 'Périodes',       icon: 'calendar_today',      routerLink: '/periodes' },
            { label: 'États de stock', icon: 'inventory',            routerLink: '/stocks/etats' },
            { label: 'Complétude',     icon: 'check_circle_outline', routerLink: '/completude' },
            { label: 'Programmes',     icon: 'tune',                 routerLink: '/structure-programme' },
          ]
        },
        {
          label: 'Redistribution', icon: 'swap_horiz',
          items: [
            { label: 'Générer un plan', icon: 'bolt',     routerLink: '/plans/generation' },
            { label: 'Suivi des plans', icon: 'list_alt', routerLink: '/plans/suivi' },
          ]
        },
        {
          label: 'Paramètres', icon: 'settings',
          directLink: '/parametres'
        }
      ];
    } else if (role === 'ADMIN') {
      this.navGroups = [
        {
          label: 'Tableau de bord', icon: 'pie_chart',
          directLink: '/tableau-bord'
        },
        {
          label: 'Analyse', icon: 'analytics',
          items: [
            { label: 'États de stock', icon: 'inventory', routerLink: '/stocks/etats' },
          ]
        },
        {
          label: 'Plans', icon: 'assignment',
          items: [
            { label: 'Suivi des plans', icon: 'list_alt', routerLink: '/plans/suivi' },
          ]
        },
        {
          label: 'Administration', icon: 'admin_panel_settings',
          items: [
            { label: 'Référentiel', icon: 'storage', routerLink: '/referentiel' },
            { label: 'Base de données', icon: 'table_chart', routerLink: '/admin/swagger' },
            { label: 'Paramètres région', icon: 'tune', routerLink: '/parametres' },
          ]
        }
      ];
    } else if (role === 'SUPERVISEUR') {
      this.navGroups = [
        {
          label: 'Tableau de bord', icon: 'dashboard',
          directLink: '/tableau-bord'
        },
        {
          label: 'Saisies', icon: 'assignment',
          items: [
            { label: 'États de stock', icon: 'inventory',            routerLink: '/stocks/etats' },
            { label: 'Complétude',     icon: 'check_circle_outline', routerLink: '/completude' },
          ]
        },
        {
          label: 'Plans', icon: 'assignment',
          items: [
            { label: 'Suivi des plans', icon: 'list_alt', routerLink: '/plans/suivi' },
          ]
        }
      ];
    }
  }
}
