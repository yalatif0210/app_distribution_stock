import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { PlanService } from '../../../core/services/plan.service';
import { AnalyseProduit, LignePlan, PlanReattribution, StructureAnalyse } from '../../../core/models/models';
import { Pagination, PaginationComponent } from '../../../shared/pagination';

/** Une ligne de saisie : une cible, une quantité, une source. Plusieurs lignes possibles par cible. */
interface Ligne {
  cle: number;
  cibleId: number;
  principale: boolean;
  quantite: number | null;
  sourceId: number | null;
  ligneId: number | null;
  /** « source:quantité » de la dernière valeur enregistrée, pour ne pas renvoyer la même chose */
  enregistre: string | null;
  etat: 'vide' | 'incomplete' | 'enregistrement' | 'ok' | 'erreur';
  message: string;
  enCours: boolean;
  aRefaire: boolean;
  minuteur?: ReturnType<typeof setTimeout>;
}

/**
 * Répartition manuelle d'un plan, produit par produit.
 * À gauche les sites en tension (cibles) : quantité et source pour chacun.
 * À droite les sources : ce qu'elles peuvent céder et ce qu'il leur reste, mis à jour en direct.
 * Chaque ligne s'enregistre automatiquement (comme la saisie des stocks).
 */
@Component({
  selector: 'app-repartition-manuelle',
  standalone: true,
  imports: [PaginationComponent, CommonModule, FormsModule, MatButtonModule,
            MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  styles: [`
    .barre { display:flex; flex-wrap:wrap; align-items:center; gap:.75rem 1.25rem; padding:.875rem 1rem;
             background:var(--surface-color, #fff); border:1px solid var(--border-color); border-radius:.5rem; margin-bottom:1rem; }
    .produit { flex:1 1 320px; display:flex; flex-direction:column; gap:.25rem; min-width:0; }
    .etiquette { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary); }
    .choix-produit { height:2.25rem; font-size:.9rem; font-weight:600; }
    .resume { display:flex; gap:1rem; flex-wrap:wrap; font-size:.82rem; color:var(--text-secondary); }
    .resume strong { color:var(--text-primary); }
    .encarts { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(0,1fr); gap:1rem; margin-bottom:1.25rem; }
    .encart { border:1px solid var(--border-color); border-radius:.5rem; background:var(--surface-color, #fff); overflow:hidden; }
    .encart-titre { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; font-size:.8rem; font-weight:700;
                    text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid var(--border-color); }
    .cibles .encart-titre { color:#b45309; background:rgba(217,119,6,.06); }
    .sources .encart-titre { color:#1d4ed8; background:rgba(59,130,246,.06); }
    table { width:100%; border-collapse:collapse; font-size:.85rem; }
    th { text-align:left; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
         color:var(--text-secondary); padding:.5rem .6rem; border-bottom:1px solid var(--border-color); white-space:nowrap; }
    td { padding:.4rem .6rem; border-bottom:1px solid var(--border-color); vertical-align:middle; }
    .num { text-align:right; font-family:monospace; white-space:nowrap; }
    .site { font-weight:600; }
    .sous { font-size:.75rem; color:var(--text-secondary); }
    .qte { width:6.5rem; height:2rem; box-sizing:border-box; padding:0 .5rem; border:1px solid #cbd5e1; border-radius:.3rem; font:inherit; text-align:right; }
    .qte.ko { border-color:#dc2626; background:rgba(220,38,38,.05); }
    .src { min-width:11rem; }
    .choix { width:100%; height:2rem; padding:0 .5rem; border:1px solid #cbd5e1; border-radius:.3rem;
             font:inherit; font-size:.85rem; background:#fff; color:var(--text-primary); cursor:pointer; }
    .choix:focus, .qte:focus { outline:2px solid rgba(79,70,229,.35); outline-offset:0; border-color:var(--accent-color); }
    .choix.ko { border-color:#dc2626; }
    .choix.attente { border-color:#d97706; }
    .etat { width:1.75rem; text-align:center; }
    .sous-ligne td { border-top:none; }
    .ko-texte { color:#dc2626; }
    .ok-texte { color:#15803d; }
    .epuisee td { color:#94a3b8; }
    .badge { display:inline-block; font-size:.66rem; font-weight:700; padding:.05rem .35rem; border-radius:.2rem; margin-left:.3rem; }
    .ajout td { padding:.15rem .6rem .5rem; }
    .ajout-source { display:inline-flex; align-items:center; gap:.2rem; border:1px dashed #cbd5e1; background:transparent;
                    color:var(--accent-color); font:inherit; font-size:.78rem; font-weight:600; padding:.2rem .6rem .2rem .35rem;
                    border-radius:.3rem; cursor:pointer; }
    .ajout-source mat-icon { font-size:16px; width:16px; height:16px; }
    .ajout-source:hover:not(:disabled) { background:rgba(79,70,229,.06); border-color:var(--accent-color); }
    .ajout-source:disabled { color:#94a3b8; cursor:not-allowed; }
    .vide { padding:1.5rem 1rem; text-align:center; color:var(--text-secondary); font-size:.85rem; }
    @media (max-width: 900px) {
      .encarts { grid-template-columns:1fr; }
      .sources { order:-1; }
      .encart { overflow-x:auto; }
    }
  `],
  template: `
    <!-- Choix du produit -->
    <div class="barre">
      <label class="produit">
        <span class="etiquette">Produit en tension sur au moins un site</span>
        <select class="choix choix-produit" [(ngModel)]="produitId" (ngModelChange)="changerProduit()">
          <option *ngFor="let p of produits" [ngValue]="p.produitId">
            {{ p.produitNom }} · {{ nbCibles(p) }} site(s) en tension · {{ p.structuresEnSurstock.length || 0 }} source(s){{ nbMouvements(p.produitId) > 0 ? ' · ✓ ' + nbMouvements(p.produitId) + ' mouvement(s)' : '' }}
          </option>
        </select>
      </label>
      <div class="resume" *ngIf="produit">
        <span>Besoin total : <strong>{{ besoinTotal | number:'1.0-0' }}</strong></span>
        <span>Réparti : <strong [class.ok-texte]="totalReparti >= besoinTotal && besoinTotal > 0">{{ totalReparti | number:'1.0-0' }}</strong></span>
        <span>Encore cessible : <strong>{{ resteTotal | number:'1.0-0' }}</strong> {{ produit.produitUnite }}</span>
      </div>
      <div style="display:flex;gap:.25rem;">
        <button mat-icon-button (click)="produitVoisin(-1)" [disabled]="indexProduit <= 0" matTooltip="Produit précédent">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button mat-icon-button (click)="produitVoisin(1)" [disabled]="indexProduit >= produits.length - 1" matTooltip="Produit suivant">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    </div>

    <div class="encarts" *ngIf="produit">
      <!-- ── Cibles ── -->
      <div class="encart cibles">
        <div class="encart-titre"><mat-icon style="font-size:18px;width:18px;height:18px;">call_received</mat-icon> Sites en tension : à approvisionner</div>
        <table>
          <thead>
            <tr><th>Site</th><th class="num">MSD</th><th class="num">Besoin</th><th class="num">Quantité</th><th>Source</th><th></th></tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let c of pgCibles.page(cibles)">
              <tr *ngFor="let l of lignesDe(c.structureId)" [class.sous-ligne]="!l.principale">
                <td>
                  <ng-container *ngIf="l.principale">
                    <div class="site">{{ c.structureNom }}</div>
                    <div class="sous">
                      <span [style.color]="c.statutStock === 'RUPTURE' ? '#dc2626' : '#d97706'">{{ c.statutStock === 'RUPTURE' ? 'Rupture' : 'Tension' }}</span>
                      · stock {{ c.stockDisponible | number:'1.0-0' }}
                      <ng-container *ngIf="recu(c.structureId) > 0"> · MSD après : <strong class="ok-texte">{{ msdApres(c) | number:'1.1-1' }}</strong></ng-container>
                    </div>
                  </ng-container>
                  <div *ngIf="!l.principale" class="sous" style="padding-left:.75rem;">↳ source supplémentaire</div>
                </td>
                <td class="num">{{ l.principale ? (c.msd | number:'1.1-1') : '' }}</td>
                <td class="num">{{ l.principale ? (c.besoin | number:'1.0-0') : '' }}</td>
                <td class="num">
                  <input class="qte" type="number" min="0" step="1" [(ngModel)]="l.quantite"
                         [class.ko]="l.etat === 'erreur'" placeholder="0"
                         (ngModelChange)="programmer(l)" (blur)="enregistrer(l)">
                </td>
                <td class="src">
                  <select class="choix" [(ngModel)]="l.sourceId" (ngModelChange)="enregistrer(l)"
                          [class.ko]="l.etat === 'erreur'" [class.attente]="!l.sourceId && l.quantite">
                    <option [ngValue]="null">Choisir une source</option>
                    <option *ngFor="let s of sourcesPour(l)" [ngValue]="s.structureId"
                            [disabled]="reste(s.structureId) <= 0 && s.structureId !== l.sourceId">
                      {{ s.structureNom }} (reste {{ reste(s.structureId) | number:'1.0-0' }})
                    </option>
                  </select>
                </td>
                <td class="etat">
                  <mat-spinner *ngIf="l.etat === 'enregistrement'" diameter="16"></mat-spinner>
                  <mat-icon *ngIf="l.etat === 'ok'" class="ok-texte" style="font-size:18px;width:18px;height:18px;" matTooltip="Enregistré">check_circle</mat-icon>
                  <mat-icon *ngIf="l.etat === 'erreur'" class="ko-texte" style="font-size:18px;width:18px;height:18px;" [matTooltip]="l.message">error</mat-icon>
                  <mat-icon *ngIf="l.etat === 'incomplete'" style="font-size:18px;width:18px;height:18px;color:#d97706;" [matTooltip]="l.message">schedule</mat-icon>
                  <button *ngIf="!l.principale" mat-icon-button (click)="retirer(l)" matTooltip="Retirer cette source"
                          style="width:28px;height:28px;padding:2px;">
                    <mat-icon style="font-size:18px;width:18px;height:18px;">close</mat-icon>
                  </button>
                </td>
              </tr>
              <tr *ngIf="nbSourcesPossibles(c.structureId) > 1" class="sous-ligne ajout">
                <td colspan="6">
                  <button type="button" class="ajout-source" (click)="ajouterSource(c.structureId)"
                          [disabled]="!peutAjouterSource(c.structureId)"
                          [matTooltip]="raisonAjoutImpossible(c.structureId)">
                    <mat-icon>add</mat-icon> Ajouter une source pour {{ c.structureNom }}
                  </button>
                </td>
              </tr>
              <tr *ngFor="let l of lignesEnErreurDe(c.structureId)">
                <td colspan="6" class="ko-texte" style="font-size:.78rem;padding-top:0;">{{ l.message }}</td>
              </tr>
            </ng-container>
          </tbody>
        </table>
        <!-- Dans le panneau : la grille n'a que deux colonnes, cibles et sources -->
        <app-pagination [p]="pgCibles" [total]="cibles.length"></app-pagination>
      </div>

      <!-- ── Sources ── -->
      <div class="encart sources">
        <div class="encart-titre"><mat-icon style="font-size:18px;width:18px;height:18px;">call_made</mat-icon> Sources possibles</div>
        <table *ngIf="sources.length > 0">
          <thead>
            <tr><th>Site</th><th class="num">Cessible</th><th class="num">Reste</th><th>Péremption</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of pgSources.page(sources)" [class.epuisee]="reste(s.structureId) <= 0">
              <td>
                <div class="site">{{ s.structureNom }}</div>
                <div class="sous">
                  <ng-container *ngIf="s.statutStock === 'STOCK_DORMANT'">stock dormant</ng-container>
                  <ng-container *ngIf="s.statutStock !== 'STOCK_DORMANT'">MSD {{ s.msd | number:'1.1-1' }}</ng-container>
                  <span *ngIf="s.exceptionPeremption" class="badge" style="background:rgba(217,119,6,.14);color:#b45309;"
                        matTooltip="Le lot périmera avant d'être consommé : cette part peut être cédée même sous le seuil de sécurité">péremption</span>
                </div>
              </td>
              <td class="num">{{ cessible(s) | number:'1.0-0' }}</td>
              <td class="num"><strong [class.ko-texte]="reste(s.structureId) < 0">{{ reste(s.structureId) | number:'1.0-0' }}</strong></td>
              <td style="white-space:nowrap;">{{ s.expireDateFefo ? (s.expireDateFefo | date:'MM/yyyy') : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <app-pagination [p]="pgSources" [total]="sources.length"></app-pagination>
        <div *ngIf="sources.length === 0" class="vide">
          <mat-icon style="display:block;margin:0 auto .4rem;">inventory_2</mat-icon>
          Aucune source possible pour ce produit.
          <div *ngIf="produit.diagnostiqueSource" class="sous" style="margin-top:.4rem;">{{ produit.diagnostiqueSource }}</div>
        </div>
        <div class="sous" style="padding:.6rem 1rem;" *ngIf="sources.length > 0">
          Les lots qui périment le plus tôt sont en haut. Le reste baisse dès que vous répartissez.
        </div>
      </div>
    </div>
  `
})
export class RepartitionManuelleComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) plan!: PlanReattribution;
  @Input({ required: true }) produits: AnalyseProduit[] = [];
  /** Lignes du plan : passées à part pour voir les annulations faites depuis le tableau du plan. */
  @Input() lignesPlan: LignePlan[] = [];
  /** Lignes du plan après chaque enregistrement, pour le tableau du plan. */
  @Output() lignesModifiees = new EventEmitter<LignePlan[]>();

  private planService = inject(PlanService);
  produitId: number | null = null;
  // Pagination des tableaux
  pgCibles = new Pagination();
  pgSources = new Pagination();

  private lignesParProduit = new Map<number, Ligne[]>();
  private compteur = 0;
  private static readonly DELAI_MS = 700;

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['produits'] && (this.produitId === null || !this.produits.some(p => p.produitId === this.produitId))) {
      this.produitId = this.produits[0]?.produitId ?? null;
    }
    if (ch['lignesPlan'] && !ch['lignesPlan'].firstChange) this.reconcilier();
  }

  ngOnDestroy(): void {
    for (const lignes of this.lignesParProduit.values()) lignes.forEach(l => l.minuteur && clearTimeout(l.minuteur));
  }

  // ── Données affichées ──────────────────────────────────────────────────────

  get produit(): AnalyseProduit | undefined {
    return this.produits.find(p => p.produitId === this.produitId);
  }

  get indexProduit(): number {
    return this.produits.findIndex(p => p.produitId === this.produitId);
  }

  get cibles(): StructureAnalyse[] {
    const p = this.produit;
    if (!p) return [];
    return [...(p.structuresEnRupture ?? []), ...(p.structuresEnTension ?? [])]
      .sort((a, b) => (a.msd ?? 0) - (b.msd ?? 0));
  }

  /** Lots qui périment le plus tôt en premier. */
  get sources(): StructureAnalyse[] {
    return [...(this.produit?.structuresEnSurstock ?? [])].sort((a, b) =>
      (a.expireDateFefo ?? '9999').localeCompare(b.expireDateFefo ?? '9999'));
  }

  private get lignes(): Ligne[] {
    if (this.produitId === null) return [];
    let l = this.lignesParProduit.get(this.produitId);
    if (!l) { l = this.construire(this.produitId); this.lignesParProduit.set(this.produitId, l); }
    return l;
  }

  lignesDe(cibleId: number): Ligne[] {
    return this.lignes.filter(l => l.cibleId === cibleId);
  }

  lignesEnErreurDe(cibleId: number): Ligne[] {
    return this.lignesDe(cibleId).filter(l => l.etat === 'erreur' && l.message);
  }

  cessible(s: StructureAnalyse): number {
    return Math.floor(s.excedent ?? 0);
  }

  /** Ce qu'il reste à la source une fois retirées toutes les quantités saisies pour ce produit. */
  reste(sourceId: number): number {
    const s = this.sources.find(x => x.structureId === sourceId);
    if (!s) return 0;
    const pris = this.lignes.filter(l => l.sourceId === sourceId).reduce((t, l) => t + (Number(l.quantite) || 0), 0);
    return this.cessible(s) - pris;
  }

  recu(cibleId: number): number {
    return this.lignesDe(cibleId).filter(l => l.sourceId).reduce((t, l) => t + (Number(l.quantite) || 0), 0);
  }

  msdApres(c: StructureAnalyse): number {
    return c.cmm ? (Number(c.stockDisponible) + this.recu(c.structureId)) / c.cmm : 0;
  }

  get besoinTotal(): number { return this.cibles.reduce((t, c) => t + (Number(c.besoin) || 0), 0); }
  get totalReparti(): number { return this.lignes.filter(l => l.sourceId).reduce((t, l) => t + (Number(l.quantite) || 0), 0); }
  get resteTotal(): number { return this.sources.reduce((t, s) => t + Math.max(0, this.reste(s.structureId)), 0); }

  nbCibles(p: AnalyseProduit): number {
    return (p.structuresEnRupture?.length ?? 0) + (p.structuresEnTension?.length ?? 0);
  }

  nbMouvements(produitId: number): number {
    return (this.plan?.lignes ?? []).filter(l => l.produitId === produitId && l.statut !== 'ANNULE').length;
  }

  /** Sources proposées pour une ligne : pas la cible elle-même, ni une source déjà prise par une autre ligne du même site. */
  sourcesPour(l: Ligne): StructureAnalyse[] {
    const prises = new Set(this.lignesDe(l.cibleId).filter(x => x !== l && x.sourceId).map(x => x.sourceId));
    return this.sources.filter(s => s.structureId !== l.cibleId && !prises.has(s.structureId));
  }

  /** Sources qui peuvent servir ce site (toutes sauf lui-même). */
  nbSourcesPossibles(cibleId: number): number {
    return this.sources.filter(s => s.structureId !== cibleId).length;
  }

  raisonAjoutImpossible(cibleId: number): string {
    if (this.peutAjouterSource(cibleId)) return '';
    return this.lignesDe(cibleId).some(l => !l.sourceId)
      ? "Choisissez d'abord une source sur la ligne existante"
      : 'Toutes les sources possibles sont déjà utilisées pour ce site';
  }

  peutAjouterSource(cibleId: number): boolean {
    const lignes = this.lignesDe(cibleId);
    return lignes.every(l => l.sourceId) && lignes.length < this.sources.filter(s => s.structureId !== cibleId).length;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  changerProduit(): void {
    // Rien à faire : les saisies de chaque produit sont gardées, les enregistrements en attente partent seuls.
  }

  produitVoisin(sens: number): void {
    const i = this.indexProduit + sens;
    if (i >= 0 && i < this.produits.length) this.produitId = this.produits[i].produitId;
  }

  ajouterSource(cibleId: number): void {
    this.lignes.push(this.nouvelleLigne(cibleId, false));
  }

  retirer(l: Ligne): void {
    const liste = this.lignes;
    if (l.ligneId) {
      l.quantite = null;
      this.enregistrer(l, () => liste.splice(liste.indexOf(l), 1));
    } else {
      liste.splice(liste.indexOf(l), 1);
    }
  }

  /** Enregistrement différé pendant la frappe. */
  programmer(l: Ligne): void {
    if (l.minuteur) clearTimeout(l.minuteur);
    l.minuteur = setTimeout(() => this.enregistrer(l), RepartitionManuelleComponent.DELAI_MS);
  }

  /**
   * Enregistre la ligne : création, modification ou suppression selon son contenu.
   * Une seule requête à la fois par ligne ; une modification faite pendant l'envoi est
   * renvoyée ensuite. Chaque envoi porte une clé d'idempotence (intercepteur HTTP).
   */
  enregistrer(l: Ligne, apres?: () => void): void {
    if (l.minuteur) { clearTimeout(l.minuteur); l.minuteur = undefined; }
    if (l.enCours) { l.aRefaire = true; return; }
    const produitId = this.produitId!;
    const qte = Number(l.quantite) || 0;

    if (qte <= 0) {
      if (!l.ligneId) { l.etat = 'vide'; l.message = ''; apres?.(); return; }
      this.envoyer(l, this.planService.supprimerLigne(this.plan.id, l.ligneId, true), () => {
        const id = l.ligneId;
        l.ligneId = null; l.enregistre = null; l.etat = 'vide';
        this.publier((this.plan.lignes ?? []).filter(x => x.id !== id));
        apres?.();
      });
      return;
    }
    if (!l.sourceId) {
      l.etat = 'incomplete'; l.message = 'Choisissez une source pour enregistrer.';
      return;
    }
    if (this.reste(l.sourceId) < 0) {
      l.etat = 'erreur'; l.message = 'Cette quantité dépasse ce que la source peut encore céder.';
      return;
    }
    const signature = `${l.sourceId}:${qte}`;
    if (l.ligneId && l.enregistre === signature) { l.etat = 'ok'; return; }

    const corps = { produitId, structureCibleId: l.cibleId, structureSourceId: l.sourceId, quantiteProposee: qte } as Partial<LignePlan>;
    const requete = l.ligneId
      ? this.planService.modifierLigne(this.plan.id, l.ligneId, corps, true)
      : this.planService.ajouterLigne(this.plan.id, corps, true);
    this.envoyer(l, requete, (ligne: LignePlan) => {
      l.ligneId = ligne.id; l.enregistre = signature; l.etat = 'ok';
      const autres = (this.plan.lignes ?? []).filter(x => x.id !== ligne.id);
      this.publier([...autres, ligne]);
    });
  }

  private envoyer<T>(l: Ligne, requete: Observable<T>, succes: (r: T) => void): void {
    l.enCours = true; l.aRefaire = false; l.etat = 'enregistrement'; l.message = '';
    requete.subscribe({
      next: r => {
        l.enCours = false;
        succes(r);
        if (l.aRefaire) this.enregistrer(l);
      },
      error: err => {
        l.enCours = false;
        l.etat = 'erreur';
        l.message = err.error?.message || 'Enregistrement impossible.';
        if (l.aRefaire) this.enregistrer(l);
      }
    });
  }

  private publier(lignes: LignePlan[]): void {
    this.plan.lignes = lignes;
    this.lignesModifiees.emit(lignes);
  }

  // ── Construction et synchronisation avec le plan ───────────────────────────

  private nouvelleLigne(cibleId: number, principale: boolean): Ligne {
    return { cle: ++this.compteur, cibleId, principale, quantite: null, sourceId: null, ligneId: null,
             enregistre: null, etat: 'vide', message: '', enCours: false, aRefaire: false };
  }

  /** Lignes d'un produit, préremplies avec les mouvements déjà enregistrés dans le plan. */
  private construire(produitId: number): Ligne[] {
    const p = this.produits.find(x => x.produitId === produitId);
    if (!p) return [];
    const cibles = [...(p.structuresEnRupture ?? []), ...(p.structuresEnTension ?? [])];
    const resultat: Ligne[] = [];
    for (const c of cibles) {
      const existants = (this.plan?.lignes ?? []).filter(x =>
        x.produitId === produitId && x.structureCibleId === c.structureId && x.statut !== 'ANNULE');
      if (existants.length === 0) { resultat.push(this.nouvelleLigne(c.structureId, true)); continue; }
      existants.forEach((x, i) => {
        const l = this.nouvelleLigne(c.structureId, i === 0);
        l.quantite = x.quantiteProposee; l.sourceId = x.structureSourceId; l.ligneId = x.id;
        l.enregistre = `${x.structureSourceId}:${Number(x.quantiteProposee)}`; l.etat = 'ok';
        resultat.push(l);
      });
    }
    return resultat;
  }

  /** Un mouvement annulé depuis le tableau du plan disparaît aussi de la répartition. */
  private reconcilier(): void {
    const presents = new Set((this.plan?.lignes ?? []).map(l => l.id));
    for (const lignes of this.lignesParProduit.values()) {
      for (const l of [...lignes]) {
        if (l.ligneId && !presents.has(l.ligneId) && !l.enCours) {
          if (l.principale) {
            l.ligneId = null; l.quantite = null; l.sourceId = null; l.enregistre = null; l.etat = 'vide'; l.message = '';
          } else {
            lignes.splice(lignes.indexOf(l), 1);
          }
        }
      }
    }
  }
}
