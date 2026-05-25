import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ParametresComponent } from './parametres.component';
import { ParametreService, ParametreRegion } from '../../core/services/parametre.service';
import { ReferentielService } from '../../core/services/referentiel.service';
import { AuthService } from '../../core/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('ParametresComponent', () => {
  let component: ParametresComponent;
  let fixture: ComponentFixture<ParametresComponent>;
  let parametreService: jasmine.SpyObj<ParametreService>;
  let referentielService: jasmine.SpyObj<ReferentielService>;
  let authService: jasmine.SpyObj<AuthService>;
  // Spy sur l'instance réelle injectée par Angular Material (le provide: useValue
  // est écrasé par MatSnackBarModule importé par le composant standalone).
  let snackBarOpenSpy: jasmine.Spy;

  const PARAMETRE_FACTICE: ParametreRegion = {
    regionId:              1,
    regionNom:             'Analamanga Test',
    seuilStockSecuriteMsd: 2.0
  };

  beforeEach(async () => {
    parametreService    = jasmine.createSpyObj('ParametreService',    ['getParametres', 'updateParametres']);
    referentielService  = jasmine.createSpyObj('ReferentielService',  ['getRegions']);
    authService         = jasmine.createSpyObj('AuthService',         ['isAdmin', 'isPharmacienRegion']);

    // Par défaut : PHARMACIEN_REGION (non-admin)
    authService.isAdmin.and.returnValue(false);
    authService.isPharmacienRegion.and.returnValue(true);
    parametreService.getParametres.and.returnValue(of(PARAMETRE_FACTICE));

    await TestBed.configureTestingModule({
      imports: [ParametresComponent, NoopAnimationsModule],
      providers: [
        { provide: ParametreService,   useValue: parametreService },
        { provide: ReferentielService, useValue: referentielService },
        { provide: AuthService,        useValue: authService }
      ]
    }).compileComponents();

    fixture   = TestBed.createComponent(ParametresComponent);
    component = fixture.componentInstance;

    // Spy sur l'instance issue du NodeInjector du composant (pas du root injector)
    // car MatSnackBarModule crée son instance dans l'environnement du composant standalone.
    snackBarOpenSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

    fixture.detectChanges();
  });

  // ── Chargement initial ────────────────────────────────────────────────────────

  it('charge les paramètres de la région au ngOnInit', () => {
    expect(parametreService.getParametres).toHaveBeenCalledWith(undefined);
    expect(component.parametre).toEqual(PARAMETRE_FACTICE);
    expect(component.editSeuil).toBe(2.0);
    expect(component.loading).toBeFalse();
  });

  it('affiche une erreur si le chargement échoue', fakeAsync(() => {
    parametreService.getParametres.and.returnValue(throwError(() => new Error('Erreur réseau simulée')));
    component.charger();
    tick();
    flush();

    expect(component.erreur).toContain('Impossible');
    expect(component.loading).toBeFalse();
  }));

  // ── Sauvegarde ────────────────────────────────────────────────────────────────

  it('sauvegarder envoie le bon seuil et affiche un snackbar', fakeAsync(() => {
    const updated = { ...PARAMETRE_FACTICE, seuilStockSecuriteMsd: 3.0 };
    parametreService.updateParametres.and.returnValue(of(updated));

    component.editSeuil = 3.0;
    component.sauvegarder();
    tick();
    flush();

    expect(parametreService.updateParametres).toHaveBeenCalledWith(3.0, undefined);
    expect(component.parametre!.seuilStockSecuriteMsd).toBe(3.0);
    expect(component.saving).toBeFalse();
    expect(snackBarOpenSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('succès'), 'OK', jasmine.any(Object)
    );
  }));

  it('sauvegarder affiche une erreur si l\'API échoue', fakeAsync(() => {
    parametreService.updateParametres.and.returnValue(
      throwError(() => new Error('Erreur serveur simulée'))
    );

    component.editSeuil = 3.0;
    component.sauvegarder();
    tick();
    flush();

    expect(component.erreur).toContain('Erreur');
    expect(component.saving).toBeFalse();
    expect(snackBarOpenSpy).not.toHaveBeenCalled();
  }));

  // ── Validation du formulaire ─────────────────────────────────────────────────

  it('sauvegarder est bloqué si seuil null', () => {
    component.editSeuil = null;
    component.sauvegarder();
    expect(parametreService.updateParametres).not.toHaveBeenCalled();
  });

  it('sauvegarder est bloqué si seuil inférieur à 0.5', () => {
    component.editSeuil = 0.3;
    component.sauvegarder();
    expect(parametreService.updateParametres).not.toHaveBeenCalled();
  });

  it('sauvegarder est bloqué si seuil supérieur à 12', () => {
    component.editSeuil = 15;
    component.sauvegarder();
    expect(parametreService.updateParametres).not.toHaveBeenCalled();
  });

  // ── Annuler ───────────────────────────────────────────────────────────────────

  it('annuler restaure le seuil original et efface l\'erreur', () => {
    component.editSeuil = 9.0;
    component.erreur = 'Erreur précédente';
    component.annuler();

    expect(component.editSeuil).toBe(2.0); // valeur de PARAMETRE_FACTICE
    expect(component.erreur).toBe('');
  });

  // ── Mode ADMIN avec sélection de région ──────────────────────────────────────

  it('en mode admin, charge les régions disponibles au ngOnInit', fakeAsync(() => {
    authService.isAdmin.and.returnValue(true);
    authService.isPharmacienRegion.and.returnValue(false);
    referentielService.getRegions.and.returnValue(of([
      { id: 1, nom: 'Analamanga Test' },
      { id: 2, nom: 'Itasy Test' }
    ]));
    parametreService.getParametres.and.returnValue(of(PARAMETRE_FACTICE));

    // Réinitialiser et recharger le composant pour mode admin
    component.ngOnInit();
    tick();
    flush();

    expect(referentielService.getRegions).toHaveBeenCalled();
    expect(component.regions.length).toBe(2);
    expect(component.selectedRegionId).toBe(1);
  }));
});
