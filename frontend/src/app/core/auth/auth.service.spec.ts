import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { AuthResponse } from '../models/models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  // Réponse factice — ne jamais utiliser un vrai token JWT ici
  const FAKE_AUTH_RESPONSE: AuthResponse = {
    token:          'PLACEHOLDER_JWT_TOKEN_FOR_UNIT_TESTS_ONLY',
    username:       'pharmacien_test',
    role:           'PHARMACIEN_REGION',
    utilisateurId:  99,
    structureId:    null,
    regionId:       5,
    supervisedRegionIds: [],
    structureNom:   undefined,
    regionNom:      'Région Analamanga Test'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ── login ─────────────────────────────────────────────────────────────────────

  it('login persiste la réponse dans localStorage et expose currentUser', () => {
    service.login('pharmacien_test', 'PLACEHOLDER_PASSWORD_FOR_TESTS').subscribe(res => {
      expect(res.token).toBe('PLACEHOLDER_JWT_TOKEN_FOR_UNIT_TESTS_ONLY');
      expect(res.role).toBe('PHARMACIEN_REGION');
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    // Ne jamais inclure de vrais identifiants dans les assertions de test
    req.flush(FAKE_AUTH_RESPONSE);

    expect(service.currentUser).toBeTruthy();
    expect(service.currentUser?.username).toBe('pharmacien_test');
    expect(localStorage.getItem('auth')).toContain('PLACEHOLDER_JWT_TOKEN_FOR_UNIT_TESTS_ONLY');
  });

  // ── Vérifications de rôle ─────────────────────────────────────────────────────

  it('isPharmacienRegion retourne true pour PHARMACIEN_REGION', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'PHARMACIEN_REGION' });
    expect(service.isPharmacienRegion()).toBeTrue();
  });

  it('isPharmacienRegion retourne true pour ADMIN (inclus par convention)', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'ADMIN' });
    expect(service.isPharmacienRegion()).toBeTrue();
  });

  it('isPharmacienRegion retourne false pour GESTIONNAIRE', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'GESTIONNAIRE' });
    expect(service.isPharmacienRegion()).toBeFalse();
  });

  it('isGestionnaire retourne true uniquement pour GESTIONNAIRE', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'GESTIONNAIRE' });
    expect(service.isGestionnaire()).toBeTrue();
    expect(service.isPharmacienRegion()).toBeFalse();
  });

  it('isAdmin retourne false pour PHARMACIEN_REGION', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'PHARMACIEN_REGION' });
    expect(service.isAdmin()).toBeFalse();
  });

  it('isSuperviseur retourne true pour SUPERVISEUR', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'SUPERVISEUR' });
    expect(service.isSuperviseur()).toBeTrue();
  });

  // ── contextLabel ─────────────────────────────────────────────────────────────

  it('contextLabel expose le nom de la région pour PHARMACIEN_REGION', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'PHARMACIEN_REGION', regionNom: 'Analamanga' });
    expect(service.contextLabel).toBe('Analamanga');
  });

  it('contextLabel expose le nom de la structure pour GESTIONNAIRE', () => {
    simulerConnexion({
      ...FAKE_AUTH_RESPONSE, role: 'GESTIONNAIRE',
      structureId: 10, structureNom: 'CSB2 Ambatobe Test'
    });
    expect(service.contextLabel).toBe('CSB2 Ambatobe Test');
  });

  it('contextLabel est vide pour ADMIN', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, role: 'ADMIN' });
    expect(service.contextLabel).toBe('');
  });

  // ── logout ────────────────────────────────────────────────────────────────────

  it('logout efface localStorage et currentUser', () => {
    simulerConnexion(FAKE_AUTH_RESPONSE);
    service.logout();

    expect(localStorage.getItem('auth')).toBeNull();
    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
  });

  // ── Accesseurs simples ───────────────────────────────────────────────────────

  it('token retourne null si non connecté', () => {
    expect(service.token).toBeNull();
  });

  it('regionId retourne la valeur depuis currentUser', () => {
    simulerConnexion({ ...FAKE_AUTH_RESPONSE, regionId: 5 });
    expect(service.regionId).toBe(5);
  });

  // ── Helper ───────────────────────────────────────────────────────────────────

  function simulerConnexion(auth: AuthResponse): void {
    localStorage.setItem('auth', JSON.stringify(auth));
    // Recréer le service pour qu'il charge depuis localStorage
    service = TestBed.inject(AuthService);
    // Simuler la connexion via login pour les cas où on veut currentUser
    (service as any).currentUserSubject.next(auth);
  }
});
