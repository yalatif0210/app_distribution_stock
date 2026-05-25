import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
    ">
      <mat-card style="width: 420px; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <mat-icon style="font-size: 48px; width: 48px; height: 48px; color: var(--accent-color);">local_pharmacy</mat-icon>
          <h1 style="margin: .75rem 0 .25rem; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">Redistribution Stocks</h1>
          <p style="margin: 0; color: var(--text-secondary); font-size: .875rem;">Système de gestion des stocks sanitaires</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="fill" style="width: 100%; margin-bottom: .75rem;">
            <mat-label>Identifiant</mat-label>
            <input matInput formControlName="username" placeholder="Nom d'utilisateur" autocomplete="username">
            <mat-icon matPrefix style="margin-right: .5rem;">person</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="fill" style="width: 100%; margin-bottom: 1rem;">
            <mat-label>Mot de passe</mat-label>
            <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" autocomplete="current-password">
            <mat-icon matPrefix style="margin-right: .5rem;">lock</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
              <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <div *ngIf="error" style="
            display: flex;
            align-items: center;
            gap: .5rem;
            padding: .75rem 1rem;
            background: rgba(239,68,68,.1);
            border: 1px solid rgba(239,68,68,.3);
            border-radius: .375rem;
            color: #b91c1c;
            font-size: .875rem;
            margin-bottom: 1rem;
          ">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: #dc2626;">warning</mat-icon>
            {{ error }}
          </div>

          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="loading || form.invalid"
            style="width: 100%; height: 44px; font-size: .95rem; letter-spacing: .03em;"
          >
            <mat-spinner *ngIf="loading" diameter="20" style="display: inline-block; margin-right: .5rem;"></mat-spinner>
            <span *ngIf="!loading">Se connecter</span>
            <span *ngIf="loading">Connexion en cours…</span>
          </button>
        </form>
      </mat-card>
    </div>
  `
})
export class LoginComponent {
  form: FormGroup;
  error = '';
  loading = false;
  hidePassword = true;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({ username: ['', Validators.required], password: ['', Validators.required] });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true; this.error = '';
    this.auth.login(this.form.value.username, this.form.value.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: err => { this.error = err.error?.message || 'Identifiants incorrects'; this.loading = false; }
    });
  }
}
