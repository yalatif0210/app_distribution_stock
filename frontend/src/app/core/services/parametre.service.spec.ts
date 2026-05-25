import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ParametreService, ParametreRegion } from './parametre.service';

describe('ParametreService', () => {
  let service: ParametreService;
  let httpMock: HttpTestingController;

  const REGION_FACTICE: ParametreRegion = {
    regionId:             1,
    regionNom:            'Analamanga Test',
    seuilStockSecuriteMsd: 2.0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ParametreService]
    });
    service = TestBed.inject(ParametreService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getParametres ─────────────────────────────────────────────────────────────

  it('getParametres appelle GET /api/parametres/region sans paramètre', () => {
    service.getParametres().subscribe(p => {
      expect(p.regionId).toBe(1);
      expect(p.seuilStockSecuriteMsd).toBe(2.0);
    });

    const req = httpMock.expectOne('/api/parametres/region');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('regionId')).toBeFalse();
    req.flush(REGION_FACTICE);
  });

  it('getParametres inclut regionId dans les params si fourni', () => {
    service.getParametres(3).subscribe();

    const req = httpMock.expectOne(r => r.url === '/api/parametres/region');
    expect(req.request.params.get('regionId')).toBe('3');
    req.flush({ ...REGION_FACTICE, regionId: 3, regionNom: 'Vakinankaratra Test' });
  });

  it('getParametres retourne les données correctes', () => {
    let result: ParametreRegion | undefined;
    service.getParametres(1).subscribe(p => result = p);

    const req = httpMock.expectOne(r => r.url === '/api/parametres/region');
    req.flush(REGION_FACTICE);

    expect(result).toBeTruthy();
    expect(result!.regionNom).toBe('Analamanga Test');
    expect(result!.seuilStockSecuriteMsd).toBe(2.0);
  });

  // ── updateParametres ──────────────────────────────────────────────────────────

  it('updateParametres appelle PUT /api/parametres/region avec le seuil', () => {
    service.updateParametres(3.5).subscribe(p => {
      expect(p.seuilStockSecuriteMsd).toBe(3.5);
    });

    const req = httpMock.expectOne('/api/parametres/region');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.seuilStockSecuriteMsd).toBe(3.5);
    expect(req.request.body.regionId).toBeUndefined();
    req.flush({ ...REGION_FACTICE, seuilStockSecuriteMsd: 3.5 });
  });

  it('updateParametres inclut regionId dans le body si fourni', () => {
    service.updateParametres(4.0, 7).subscribe();

    const req = httpMock.expectOne('/api/parametres/region');
    expect(req.request.body.seuilStockSecuriteMsd).toBe(4.0);
    expect(req.request.body.regionId).toBe(7);
    req.flush({ ...REGION_FACTICE, seuilStockSecuriteMsd: 4.0, regionId: 7 });
  });

  it('updateParametres retourne la région mise à jour', () => {
    let updated: ParametreRegion | undefined;
    service.updateParametres(2.5).subscribe(p => updated = p);

    const req = httpMock.expectOne('/api/parametres/region');
    req.flush({ ...REGION_FACTICE, seuilStockSecuriteMsd: 2.5 });

    expect(updated!.seuilStockSecuriteMsd).toBe(2.5);
  });
});
