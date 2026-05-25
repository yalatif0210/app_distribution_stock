import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn) return true;
  router.navigate(['/login']);
  return false;
};

export const gestionnaireGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isGestionnaire() ? true : inject(Router).createUrlTree(['/']);
};

export const pharmacienOuAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return (auth.isPharmacienRegion() || auth.isAdmin())
    ? true
    : inject(Router).createUrlTree(['/']);
};
