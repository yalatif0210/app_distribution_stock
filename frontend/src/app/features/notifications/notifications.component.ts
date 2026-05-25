import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../core/models/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatIconModule, MatButtonModule, MatCardModule,
    MatProgressSpinnerModule, MatDividerModule, MatTooltipModule, MatSnackBarModule
  ],
  template: `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <h1>Notifications</h1>
        <p>Alertes et rappels de votre espace de travail</p>
      </div>
      <button mat-stroked-button color="primary" (click)="toutLire()" *ngIf="nonLues > 0">
        <mat-icon>done_all</mat-icon> Tout marquer lu ({{ nonLues }})
      </button>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="loading-overlay">
      <mat-spinner diameter="48"></mat-spinner>
      <span>Chargement des notifications…</span>
    </div>

    <!-- Empty state -->
    <div *ngIf="!loading && notifications.length === 0"
         style="text-align:center;padding:3rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:.5rem;">
      <mat-icon style="font-size:3rem;width:3rem;height:3rem;display:block;margin:0 auto 1rem;color:var(--border-color);">notifications_none</mat-icon>
      <div style="font-size:1rem;font-weight:600;color:var(--text-primary);">Aucune notification</div>
      <div style="font-size:.875rem;color:var(--text-secondary);margin-top:.25rem;">Vous êtes à jour !</div>
    </div>

    <!-- Notifications list -->
    <mat-card *ngIf="!loading && notifications.length > 0" style="padding:0;overflow:hidden;">
      <ng-container *ngFor="let n of notifications; let last = last">
        <div
          style="display:flex;align-items:flex-start;gap:1rem;padding:1rem 1.25rem;cursor:pointer;transition:background .15s;"
          [style.background]="!n.lu ? '#fafaf9' : 'transparent'"
          [style.border-left]="!n.lu ? '3px solid var(--accent-color)' : '3px solid transparent'"
          (click)="marquerLu(n)"
        >
          <!-- Icon -->
          <div style="flex-shrink:0;margin-top:.1rem;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;"
               [style.background]="notifIconBg(n.type)">
            <mat-icon [style.color]="notifIconColor(n.type)" style="font-size:18px;width:18px;height:18px;">{{ notifIcon(n.type) }}</mat-icon>
          </div>

          <!-- Content -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem;">
              <span [class]="notifBadgeClass(n.type)" style="font-size:.7rem;">{{ notifLabel(n.type) }}</span>
              <span *ngIf="!n.lu" style="background:rgba(79,70,229,.1);color:var(--accent-color);font-size:.7rem;font-weight:700;padding:.1rem .45rem;border-radius:999px;">Nouveau</span>
            </div>
            <p style="margin:0 0 .3rem;font-size:.875rem;color:var(--text-primary);"
               [style.font-weight]="!n.lu ? '600' : '400'">{{ n.message }}</p>
            <span style="color:var(--text-secondary);font-size:.78rem;">{{ n.dateEnvoi | date:'dd/MM/yyyy à HH:mm' }}</span>
          </div>

          <!-- Mark read button -->
          <button
            mat-icon-button
            *ngIf="!n.lu"
            (click)="$event.stopPropagation(); marquerLu(n)"
            matTooltip="Marquer comme lu"
            style="flex-shrink:0;color:var(--text-secondary);"
          >
            <mat-icon style="font-size:18px;width:18px;height:18px;">check</mat-icon>
          </button>
        </div>
        <mat-divider *ngIf="!last"></mat-divider>
      </ng-container>
    </mat-card>
  `
})
export class NotificationsComponent implements OnInit {
  notifications: AppNotification[] = [];
  loading = false;

  private snackBar = inject(MatSnackBar);

  get nonLues(): number { return this.notifications.filter(n => !n.lu).length; }

  constructor(private notifService: NotificationService) {}

  ngOnInit(): void {
    this.loading = true;
    this.notifService.getNotifications().subscribe({
      next: n => { this.notifications = n; this.loading = false; },
      error: () => this.loading = false
    });
  }

  marquerLu(n: AppNotification): void {
    if (n.lu) return;
    this.notifService.marquerLu(n.id).subscribe(() => {
      n.lu = true;
      this.notifService.refreshCount();
    });
  }

  toutLire(): void {
    this.notifService.marquerToutLu().subscribe(() => {
      this.notifications.forEach(n => n.lu = true);
      this.notifService.refreshCount();
      this.snackBar.open('Toutes les notifications marquées comme lues.', 'OK', { duration: 3000 });
    });
  }

  notifIcon(type: string): string {
    if (type === 'RAPPEL_EXECUTION') return 'alarm';
    if (type === 'ALERTE_RETARD')    return 'warning_amber';
    return 'info';
  }

  notifLabel(type: string): string {
    if (type === 'RAPPEL_EXECUTION') return 'Rappel exécution';
    if (type === 'ALERTE_RETARD')    return 'Alerte retard';
    return 'Information';
  }

  notifIconColor(type: string): string {
    if (type === 'RAPPEL_EXECUTION') return '#b45309';
    if (type === 'ALERTE_RETARD')    return '#b91c1c';
    return '#0369a1';
  }

  notifIconBg(type: string): string {
    if (type === 'RAPPEL_EXECUTION') return 'rgba(180,83,9,.1)';
    if (type === 'ALERTE_RETARD')    return 'rgba(185,28,28,.08)';
    return 'rgba(3,105,161,.08)';
  }

  notifBadgeClass(type: string): string {
    if (type === 'ALERTE_RETARD')    return 'badge badge-rupture';
    if (type === 'RAPPEL_EXECUTION') return 'badge badge-surveiller';
    return 'badge badge-ouverte';
  }
}
