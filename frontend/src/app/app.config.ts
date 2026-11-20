import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { chargementInterceptor } from './core/http/chargement';
import { dedoublonnageInterceptor } from './core/http/dedoublonnage.interceptor';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { PaginatorIntlFr } from './shared/pagination';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([chargementInterceptor, dedoublonnageInterceptor, jwtInterceptor])),
    provideAnimationsAsync(),
    // Paginateurs en français dans toute l'application
    { provide: MatPaginatorIntl, useClass: PaginatorIntlFr }
  ]
};
