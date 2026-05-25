import { Routes } from '@angular/router';
import { authGuard, gestionnaireGuard, pharmacienOuAdminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'stocks/tableau-bord', pathMatch: 'full' },
      {
        path: 'stocks',
        children: [
          { path: 'tableau-bord', loadComponent: () => import('./features/stocks/tableau-bord/tableau-bord.component').then(m => m.TableauBordComponent) },
          { path: 'saisie', loadComponent: () => import('./features/stocks/saisie/saisie.component').then(m => m.SaisieComponent), canActivate: [gestionnaireGuard] },
          { path: 'import', loadComponent: () => import('./features/stocks/import/import.component').then(m => m.ImportComponent), canActivate: [gestionnaireGuard] },
          { path: 'etats', loadComponent: () => import('./features/stocks/etats/etats.component').then(m => m.EtatsComponent) },
          { path: 'selection-produits', loadComponent: () => import('./features/stocks/selection-produits/selection-produits.component').then(m => m.SelectionProduitsComponent) },
        ]
      },
      {
        path: 'plans',
        children: [
          { path: 'generation', loadComponent: () => import('./features/plans/generation/generation.component').then(m => m.GenerationComponent), canActivate: [pharmacienOuAdminGuard] },
          { path: ':id/edition', loadComponent: () => import('./features/plans/edition/edition.component').then(m => m.EditionComponent) },
          { path: 'suivi', loadComponent: () => import('./features/plans/suivi/suivi.component').then(m => m.SuiviComponent) },
        ]
      },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'referentiel', loadComponent: () => import('./features/referentiel/referentiel.component').then(m => m.ReferentielComponent) },
      // New routes
      { path: 'periodes', loadComponent: () => import('./features/periodes/periodes.component').then(m => m.PeriodesComponent), canActivate: [authGuard] },
      { path: 'completude', loadComponent: () => import('./features/completude/completude.component').then(m => m.CompletudeComponent), canActivate: [authGuard] },
      { path: 'structure-programme', loadComponent: () => import('./features/structure-programme/structure-programme.component').then(m => m.StructureProgrammeComponent), canActivate: [authGuard] },
      { path: 'tableau-bord', loadComponent: () => import('./features/tableau-bord/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
      { path: 'admin/swagger', loadComponent: () => import('./features/admin/admin-swagger.component').then(m => m.AdminSwaggerComponent), canActivate: [authGuard] },
      { path: 'parametres', loadComponent: () => import('./features/parametres/parametres.component').then(m => m.ParametresComponent), canActivate: [authGuard, pharmacienOuAdminGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];
