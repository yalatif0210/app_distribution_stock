import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalyseBlocComponent } from './analyse-bloc.component';
import {
  Analyses, AnalysesService, Boite, Cellule, DispersionProduit, Flux, Interpretation
} from '../../core/services/analyses.service';

/** Nœud et lien du diagramme des flux entre districts. */
interface NoeudFlux { nom: string; total: number; y: number; h: number; couleur: string; }
interface LienFlux { d: string; largeur: number; couleur: string; titre: string; }

const COULEURS_STATUT: Record<string, { fond: string; texte: string; libelle: string }> = {
  RUPTURE:       { fond: '#ef4444', texte: '#fff',    libelle: 'Rupture' },
  TENSION:       { fond: '#f97316', texte: '#fff',    libelle: 'Tension' },
  SURVEILLER:    { fond: '#facc15', texte: '#422006', libelle: 'À surveiller' },
  BIEN_STOCKE:   { fond: '#22c55e', texte: '#fff',    libelle: 'Bien stocké' },
  SURSTOCK:      { fond: '#a855f7', texte: '#fff',    libelle: 'Surstock' },
  STOCK_DORMANT: { fond: '#94a3b8', texte: '#fff',    libelle: 'Stock dormant' }
};
const PALETTE_DISTRICTS = ['#4f46e5', '#0891b2', '#16a34a', '#ca8a04', '#db2777', '#7c3aed', '#ea580c', '#475569'];

/**
 * Onglet « Synthèses » du tableau de bord : les six analyses d'un plan, chacune avec son
 * explication, sa visualisation, sa lecture et ses actions « À faire », plus les flux
 * entre districts.
 */
@Component({
  selector: 'app-analyses-onglet',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, AnalyseBlocComponent],
  styles: [`
    .bascule { display:inline-flex; border:1px solid var(--border-color); border-radius:.4rem; overflow:hidden; margin-bottom:.75rem; }
    .bascule button { border:none; background:transparent; padding:.3rem .8rem; font:inherit; font-size:.8rem; cursor:pointer; color:var(--text-primary); }
    .bascule button + button { border-left:1px solid var(--border-color); }
    .bascule button.actif { background:var(--accent-color); color:#fff; }
    .legende { display:flex; flex-wrap:wrap; gap:.4rem .9rem; font-size:.75rem; color:var(--text-secondary); margin:.25rem 0 .75rem; }
    .legende span { display:inline-flex; align-items:center; gap:.3rem; }
    .pastille { width:12px; height:12px; border-radius:3px; display:inline-block; }
    table.carte { border-collapse:separate; border-spacing:2px; font-size:.72rem; }
    table.carte th { font-weight:600; color:var(--text-secondary); padding:.2rem .3rem; white-space:nowrap; }
    table.carte th.produit { writing-mode:vertical-rl; transform:rotate(180deg); text-align:left; max-height:140px;
                             overflow:hidden; text-overflow:ellipsis; vertical-align:bottom; }
    table.carte th.site { text-align:left; position:sticky; left:0; background:var(--bg-card, #fff); z-index:1;
                          max-width:200px; overflow:hidden; text-overflow:ellipsis; }
    table.carte td { min-width:38px; height:26px; text-align:center; border-radius:3px; font-family:monospace; }
    table.carte td.vide { background:repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #fff 3px, #fff 6px); }
    table.carte td.change { outline:2px solid #1e293b; outline-offset:-2px; }
    table.liste { width:100%; border-collapse:collapse; font-size:.82rem; }
    table.liste th { text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary);
                     padding:.4rem .5rem; border-bottom:1px solid var(--border-color); }
    table.liste td { padding:.4rem .5rem; border-bottom:1px solid var(--border-color); }
    table.liste td.num, table.liste th.num { text-align:right; font-family:monospace; }
    .defile { max-height:340px; overflow:auto; }
    .vide-msg { padding:1rem; text-align:center; color:var(--text-secondary); font-size:.85rem; }
    .chip { padding:.12rem .5rem; border-radius:999px; font-size:.68rem; font-weight:700; white-space:nowrap; }
    .grille-2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem; }
    .sous-titre { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-secondary); margin-bottom:.4rem; }
    .chiffres { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; }
    .chiffre { border:1px solid var(--border-color); border-radius:.45rem; padding:.6rem .9rem; min-width:150px; }
    .chiffre .v { font-size:1.4rem; font-weight:800; }
    .chiffre .l { font-size:.72rem; color:var(--text-secondary); }
    .boite-ligne { display:grid; grid-template-columns:minmax(140px, 220px) 1fr 150px; gap:.75rem; align-items:center;
                   padding:.3rem 0; border-bottom:1px dashed var(--border-color); }
    .boite-ligne .nom { font-size:.8rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .barre-fond { background:#f1f5f9; border-radius:3px; height:8px; width:120px; display:inline-block; vertical-align:middle; overflow:hidden; }
    .barre { height:100%; border-radius:3px; }
    .points { letter-spacing:2px; font-size:.9rem; }
    svg text { font-family:inherit; }
  `],
  template: `
    <div *ngIf="chargement" style="display:flex;align-items:center;justify-content:center;gap:.75rem;height:220px;color:var(--text-secondary);">
      <mat-spinner diameter="36"></mat-spinner> Calcul des analyses…
    </div>
    <div *ngIf="erreur" class="vide-msg" style="color:#b91c1c;">{{ erreur }}</div>

    <ng-container *ngIf="!chargement && a">
      <div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:1rem;">
        Chaque analyse se lit en trois temps : la visualisation, la <b>lecture</b> calculée par le Système à partir de barèmes
        réglés par l'administrateur, puis les actions <b>« À faire »</b>. « Après » le plan :
        {{ a.baseApres === 'EXECUTEE' ? 'quantités réellement livrées' : 'quantités prévues (théorique)' }}.
      </div>

      <!-- 1. Matrice -->
      <app-analyse-bloc titre="1. Carte des statuts sites × produits" icone="grid_on" [interpretation]="a.matrice.interpretation">
        <div explication>
          Chaque ligne est un site, chaque colonne un produit ; la couleur donne le statut du stock (MSD = stock ÷ CMM).
          Basculez entre « avant » et « après » pour voir ce que le plan corrige : une ligne qui reste orange ou rouge
          signale un site fragile (au moins {{ a.baremes.fragilitePct | number:'1.0-0' }} % de ses produits en tension ou rupture),
          une colonne qui reste rouge un produit en tension dans toute la région.
          Les cases encadrées changent de statut avec le plan. Une case hachurée : produit sans état de stock pour ce site.
        </div>
        <div class="bascule" role="radiogroup" aria-label="Moment affiché">
          <button type="button" role="radio" [class.actif]="momentCarte === 'avant'" [attr.aria-checked]="momentCarte === 'avant'" (click)="momentCarte = 'avant'">Avant le plan</button>
          <button type="button" role="radio" [class.actif]="momentCarte === 'apres'" [attr.aria-checked]="momentCarte === 'apres'" (click)="momentCarte = 'apres'">Après le plan</button>
        </div>
        <div class="legende">
          <span *ngFor="let s of statuts"><i class="pastille" [style.background]="s.fond"></i>{{ s.libelle }}</span>
        </div>
        <div *ngIf="!a.matrice.cellules.length" class="vide-msg">Aucun état de stock soumis.</div>
        <div *ngIf="a.matrice.cellules.length" style="overflow:auto;max-height:560px;">
          <table class="carte">
            <thead>
              <tr>
                <th class="site"></th>
                <th *ngFor="let p of a.matrice.produits" class="produit" [matTooltip]="p.nom">{{ p.code || p.nom }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of a.matrice.sites">
                <th class="site" [matTooltip]="s.nom">{{ s.nom }}</th>
                <ng-container *ngFor="let p of a.matrice.produits">
                  <ng-container *ngIf="cellule(s.id, p.id) as c; else caseVide">
                    <td [style.background]="couleur(momentCarte === 'avant' ? c.statutAvant : c.statutApres).fond"
                        [style.color]="couleur(momentCarte === 'avant' ? c.statutAvant : c.statutApres).texte"
                        [class.change]="c.statutAvant !== c.statutApres"
                        [matTooltip]="infoCellule(s.nom, p.nom, c)">
                      {{ (momentCarte === 'avant' ? c.msdAvant : c.msdApres) | number:'1.0-1' }}
                    </td>
                  </ng-container>
                  <ng-template #caseVide><td class="vide"></td></ng-template>
                </ng-container>
              </tr>
            </tbody>
          </table>
        </div>
      </app-analyse-bloc>

      <!-- 2. Dispersion -->
      <app-analyse-bloc titre="2. Dispersion des MSD entre sites" icone="candlestick_chart" [interpretation]="a.dispersion.interpretation">
        <div explication>
          Pour chaque produit consommé par au moins 3 sites, une « boîte à moustaches » résume la répartition des MSD :
          les moustaches vont du site le moins stocké au plus stocké, la boîte contient la moitié centrale des sites
          (du 1er au 3e quartile) et le trait la médiane. Une boîte qui se resserre après le plan signifie que les stocks
          sont mieux répartis. Verdict sur l'écart interquartile : resserrement d'au moins {{ a.baremes.equilibrageNetPct | number:'1.0-0' }} %
          = équilibrage net ; d'au moins {{ a.baremes.equilibrageModerePct | number:'1.0-0' }} % = modéré ; en deçà = sans effet ;
          élargissement = déséquilibre.
        </div>
        <div *ngIf="!a.dispersion.produits.length" class="vide-msg">Aucun produit consommé par au moins 3 sites.</div>
        <ng-container *ngIf="a.dispersion.produits.length">
          <div class="legende">
            <span><i class="pastille" style="background:#cbd5e1;"></i>Avant le plan</span>
            <span><i class="pastille" style="background:#818cf8;"></i>Après le plan</span>
            <span>Échelle : 0 à {{ echelleMsd | number:'1.0-0' }} mois de stock{{ echelleTronquee ? ' (valeurs supérieures ramenées au bord)' : '' }}</span>
          </div>
          <div class="defile" style="max-height:520px;">
            <div class="boite-ligne" *ngFor="let p of a.dispersion.produits">
              <div class="nom" [matTooltip]="p.produit + ' — ' + p.nbSites + ' sites'">{{ p.produit }}</div>
              <svg viewBox="0 0 600 40" style="width:100%;height:auto;display:block;" role="img"
                   [attr.aria-label]="'Dispersion des MSD de ' + p.produit">
                <ng-container *ngFor="let g of [0.25, 0.5, 0.75]">
                  <line [attr.x1]="g * 600" [attr.x2]="g * 600" y1="0" y2="40" stroke="#e2e8f0" stroke-dasharray="2 3" />
                </ng-container>
                <g *ngFor="let m of [{ b: p.avant, y: 11, fond: '#cbd5e1', trait: '#64748b', titre: 'Avant' }, { b: p.apres, y: 29, fond: '#818cf8', trait: '#3730a3', titre: 'Après' }]">
                  <title>{{ m.titre }} : min {{ m.b.min | number:'1.1-1' }}, Q1 {{ m.b.q1 | number:'1.1-1' }}, médiane {{ m.b.mediane | number:'1.1-1' }}, Q3 {{ m.b.q3 | number:'1.1-1' }}, max {{ m.b.max | number:'1.1-1' }} mois</title>
                  <line [attr.x1]="x(m.b.min)" [attr.x2]="x(m.b.max)" [attr.y1]="m.y" [attr.y2]="m.y" [attr.stroke]="m.trait" stroke-width="1.5" />
                  <line [attr.x1]="x(m.b.min)" [attr.x2]="x(m.b.min)" [attr.y1]="m.y - 4" [attr.y2]="m.y + 4" [attr.stroke]="m.trait" stroke-width="1.5" />
                  <line [attr.x1]="x(m.b.max)" [attr.x2]="x(m.b.max)" [attr.y1]="m.y - 4" [attr.y2]="m.y + 4" [attr.stroke]="m.trait" stroke-width="1.5" />
                  <rect [attr.x]="x(m.b.q1)" [attr.y]="m.y - 6" [attr.width]="largeurBoite(m.b)" height="12" rx="2"
                        [attr.fill]="m.fond" [attr.stroke]="m.trait" stroke-width="1" />
                  <line [attr.x1]="x(m.b.mediane)" [attr.x2]="x(m.b.mediane)" [attr.y1]="m.y - 6" [attr.y2]="m.y + 6" [attr.stroke]="m.trait" stroke-width="2.5" />
                </g>
              </svg>
              <div style="text-align:right;">
                <span class="chip" [style.background]="verdictDispersion(p.verdict).fond" [style.color]="verdictDispersion(p.verdict).texte">{{ verdictDispersion(p.verdict).libelle }}</span>
                <div *ngIf="p.variationPct !== null" style="font-size:.7rem;color:var(--text-secondary);margin-top:.15rem;font-family:monospace;">
                  écart {{ p.variationPct > 0 ? '+' : '' }}{{ p.variationPct | number:'1.0-1' }} %
                </div>
              </div>
            </div>
          </div>
          <div class="boite-ligne" style="border-bottom:none;">
            <div></div>
            <svg viewBox="0 0 600 18" style="width:100%;height:auto;display:block;" aria-hidden="true">
              <text *ngFor="let g of [0, 0.25, 0.5, 0.75, 1]" [attr.x]="g * 600" y="13" font-size="12" fill="#64748b"
                    [attr.text-anchor]="g === 0 ? 'start' : (g === 1 ? 'end' : 'middle')">{{ g * echelleMsd | number:'1.0-1' }} mois</text>
            </svg>
            <div></div>
          </div>
        </ng-container>
      </app-analyse-bloc>

      <!-- 3. Péremptions -->
      <app-analyse-bloc titre="3. Péremptions évitées et lots à risque" icone="event_busy" [interpretation]="a.peremptions.interpretation">
        <div explication>
          Une quantité « périmable » est la part du stock d'un site qu'il ne consommera pas avant la date de péremption
          (stock au-delà de CMM × mois restants), ou tout le stock d'un site qui ne consomme plus le produit.
          « Évitées » : quantités périmables que le plan envoie vers un site qui les consommera.
          « À risque » : quantités périmables qui restent sur place après le plan ; ce sont les prochaines candidates
          à une redistribution ou à un retour.
        </div>
        <div class="grille-2">
          <div>
            <div class="sous-titre" style="color:#15803d;">Évitées par le plan ({{ a.peremptions.evitees.length }})</div>
            <div *ngIf="!a.peremptions.evitees.length" class="vide-msg">Aucune quantité périmable déplacée.</div>
            <div class="defile" *ngIf="a.peremptions.evitees.length">
              <table class="liste">
                <thead><tr><th>Site source</th><th>Produit</th><th class="num">Quantité</th><th>Péremption</th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of a.peremptions.evitees">
                    <td>{{ l.site }}</td><td>{{ l.produit }}</td>
                    <td class="num">{{ l.quantite | number:'1.0-0' }} <span style="color:var(--text-secondary);">{{ l.unite }}</span></td>
                    <td>{{ l.datePeremption | date:'dd/MM/yyyy' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="sous-titre" style="color:#b91c1c;">Encore à risque après le plan ({{ a.peremptions.aRisque.length }})</div>
            <div *ngIf="!a.peremptions.aRisque.length" class="vide-msg">Aucun lot à risque de péremption.</div>
            <div class="defile" *ngIf="a.peremptions.aRisque.length">
              <table class="liste">
                <thead><tr><th>Site</th><th>Produit</th><th class="num">Quantité</th><th>Péremption</th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of a.peremptions.aRisque">
                    <td>{{ l.site }}</td><td>{{ l.produit }}</td>
                    <td class="num">{{ l.quantite | number:'1.0-0' }} <span style="color:var(--text-secondary);">{{ l.unite }}</span></td>
                    <td [style.color]="joursAvant(l.datePeremption) < 90 ? '#b91c1c' : null">{{ l.datePeremption | date:'dd/MM/yyyy' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </app-analyse-bloc>

      <!-- 4. Alerte précoce -->
      <app-analyse-bloc titre="4. Alerte précoce : ruptures à venir" icone="notifications_active" [interpretation]="a.alerte.interpretation">
        <div explication>
          Le MSD dit combien de mois le stock tiendra. En le convertissant en jours (MSD × 30,4) et en retirant les jours
          écoulés depuis la date de l'état de stock, on estime la date à laquelle chaque site tombera en rupture.
          L'analyse compte les ruptures attendues dans les {{ a.alerte.horizonJours }} prochains jours, avant et après le plan,
          et liste celles que le plan ne prévient pas. Plus l'état de stock est ancien, moins l'estimation est fiable.
        </div>
        <div class="chiffres">
          <div class="chiffre"><div class="v" style="color:#ef4444;">{{ a.alerte.nbAvant }}</div><div class="l">ruptures sous {{ a.alerte.horizonJours }} j sans le plan</div></div>
          <div class="chiffre"><div class="v" [style.color]="a.alerte.nbApres < a.alerte.nbAvant ? '#16a34a' : '#ef4444'">{{ a.alerte.nbApres }}</div><div class="l">ruptures sous {{ a.alerte.horizonJours }} j avec le plan</div></div>
          <div class="chiffre"><div class="v" [style.color]="a.alerte.ageEtatJours > 45 ? '#b45309' : 'var(--text-primary)'">{{ a.alerte.ageEtatJours }} j</div><div class="l">âge de l'état de stock</div></div>
        </div>
        <div *ngIf="!a.alerte.restantes.length" class="vide-msg">Aucune rupture attendue dans l'horizon après le plan.</div>
        <div class="defile" *ngIf="a.alerte.restantes.length">
          <table class="liste">
            <thead><tr><th>Site</th><th>Produit</th><th>Jours restants</th><th>Date estimée</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of a.alerte.restantes">
                <td>{{ r.site }}</td><td>{{ r.produit }}</td>
                <td>
                  <span class="barre-fond"><span class="barre" style="display:block;"
                        [style.width.%]="pourcent(r.joursRestants, a.alerte.horizonJours)"
                        [style.background]="r.joursRestants <= 0 ? '#ef4444' : (r.joursRestants < a.alerte.horizonJours / 2 ? '#f97316' : '#facc15')"></span></span>
                  <span style="font-family:monospace;margin-left:.4rem;">{{ r.joursRestants <= 0 ? 'déjà en rupture' : r.joursRestants + ' j' }}</span>
                </td>
                <td>{{ r.dateEstimee | date:'dd/MM/yyyy' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </app-analyse-bloc>

      <!-- 5. Chroniques -->
      <app-analyse-bloc titre="5. Ruptures et surstocks chroniques" icone="history" [interpretation]="a.chroniques.interpretation">
        <div explication>
          Une rupture ponctuelle se corrige par une redistribution ; une rupture qui revient période après période
          révèle un problème de fond (CMM sous-estimée, dotation insuffisante, retard d'approvisionnement).
          L'analyse examine les {{ a.chroniques.fenetre }} dernières périodes de la région : un couple site/produit
          en rupture au moins {{ a.chroniques.occurrences }} fois est dit chronique ; de même pour un produit en surstock
          ou dormant sur plusieurs sites de façon répétée.
          <span *ngIf="a.chroniques.periodesAnalysees < a.chroniques.fenetre"><br>Historique disponible : {{ a.chroniques.periodesAnalysees }} période(s) sur {{ a.chroniques.fenetre }}.</span>
        </div>
        <div class="grille-2">
          <div>
            <div class="sous-titre">Ruptures récurrentes ({{ a.chroniques.ruptures.length }})</div>
            <div *ngIf="!a.chroniques.ruptures.length" class="vide-msg">Aucune rupture chronique.</div>
            <div class="defile" *ngIf="a.chroniques.ruptures.length">
              <table class="liste">
                <thead><tr><th>Site</th><th>Produit</th><th>Périodes en rupture</th></tr></thead>
                <tbody>
                  <tr *ngFor="let c of a.chroniques.ruptures">
                    <td>{{ c.site }}</td><td>{{ c.produit }}</td>
                    <td [matTooltip]="c.nbFois + ' période(s) sur ' + a.chroniques.periodesAnalysees">
                      <span class="points"><span style="color:#ef4444;">{{ points(c.nbFois) }}</span><span style="color:#cbd5e1;">{{ points(a.chroniques.periodesAnalysees - c.nbFois) }}</span></span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="sous-titre">Surstocks récurrents ({{ a.chroniques.surstocks.length }})</div>
            <div *ngIf="!a.chroniques.surstocks.length" class="vide-msg">Aucun surstock chronique.</div>
            <div class="defile" *ngIf="a.chroniques.surstocks.length">
              <table class="liste">
                <thead><tr><th>Produit</th><th>Sites en surstock chronique</th></tr></thead>
                <tbody>
                  <tr *ngFor="let s of a.chroniques.surstocks">
                    <td>{{ s.produit }}</td>
                    <td>
                      <span class="barre-fond"><span class="barre" style="display:block;background:#a855f7;" [style.width.%]="pourcent(s.nbSites, s.nbSitesSuivis)"></span></span>
                      <span style="font-family:monospace;margin-left:.4rem;">{{ s.nbSites }}/{{ s.nbSitesSuivis }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </app-analyse-bloc>

      <!-- 6. Fiabilité -->
      <app-analyse-bloc titre="6. Fiabilité de l'exécution par site source" icone="local_shipping" [interpretation]="a.fiabilite.interpretation">
        <div explication>
          Sur les plans validés ces 12 derniers mois pour la même région et le même programme ({{ a.fiabilite.nbPlans }} plan(s)),
          on mesure pour chaque site source la part livrée des quantités prévues (moyenne des mouvements, plafonnée à 100 %),
          les mouvements en retard (non exécutés {{ a.baremes.retardJours }} jours après la validation) et le délai moyen de livraison.
          Fiabilité bonne à partir de {{ a.baremes.fiabiliteBonnePct | number:'1.0-0' }} %, faible sous {{ a.baremes.fiabiliteFaiblePct | number:'1.0-0' }} %.
          Un plan n'a d'effet que s'il est exécuté : une source peu fiable doit être relancée ou moins sollicitée.
        </div>
        <div *ngIf="!a.fiabilite.sites.length" class="vide-msg">Aucun mouvement sur les plans validés de la période.</div>
        <div class="defile" *ngIf="a.fiabilite.sites.length">
          <table class="liste">
            <thead><tr><th>Site source</th><th class="num">Mouvements</th><th>Taux de livraison</th><th class="num">En retard</th><th class="num">Délai moyen</th><th>Verdict</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of a.fiabilite.sites">
                <td>{{ s.site }}</td>
                <td class="num">{{ s.nbMouvements }}</td>
                <td>
                  <span class="barre-fond"><span class="barre" style="display:block;" [style.width.%]="s.tauxLivraison" [style.background]="verdictFiabilite(s.verdict).fond"></span></span>
                  <span style="font-family:monospace;margin-left:.4rem;">{{ s.tauxLivraison | number:'1.0-1' }} %</span>
                </td>
                <td class="num" [style.color]="s.nbEnRetard ? '#b91c1c' : null">{{ s.nbEnRetard }}</td>
                <td class="num">{{ s.delaiMoyenJours === null ? '—' : (s.delaiMoyenJours | number:'1.0-1') + ' j' }}</td>
                <td><span class="chip" [style.background]="verdictFiabilite(s.verdict).fond" style="color:#fff;">{{ verdictFiabilite(s.verdict).libelle }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </app-analyse-bloc>

      <!-- Flux entre districts -->
      <app-analyse-bloc titre="Flux entre districts" icone="swap_horiz" [interpretation]="lectureFlux">
        <div explication>
          À gauche les districts d'où partent les produits, à droite ceux qui les reçoivent ; l'épaisseur de chaque bande
          est proportionnelle au nombre de mouvements. Une bande qui relie un district à lui-même correspond à des échanges
          internes, les plus simples à organiser. Les grosses bandes entre districts éloignés méritent une attention
          logistique (transport, délais).
        </div>
        <div *ngIf="!a.flux.length" class="vide-msg">Aucun mouvement dans ce plan.</div>
        <svg *ngIf="a.flux.length" [attr.viewBox]="'0 0 800 ' + hauteurSankey" style="width:100%;max-width:960px;height:auto;display:block;margin:0 auto;" role="img" aria-label="Flux de mouvements entre districts">
          <path *ngFor="let l of liensSankey" [attr.d]="l.d" fill="none" [attr.stroke]="l.couleur" stroke-opacity=".35"
                [attr.stroke-width]="l.largeur"><title>{{ l.titre }}</title></path>
          <g *ngFor="let n of noeudsSources">
            <rect x="200" [attr.y]="n.y" width="12" [attr.height]="n.h" [attr.fill]="n.couleur" rx="2"><title>{{ n.nom }} : {{ n.total }} mouvement(s) au départ</title></rect>
            <text x="192" [attr.y]="n.y + n.h / 2" text-anchor="end" dominant-baseline="middle" font-size="13" fill="#1e293b">{{ n.nom }} ({{ n.total }})</text>
          </g>
          <g *ngFor="let n of noeudsCibles">
            <rect x="588" [attr.y]="n.y" width="12" [attr.height]="n.h" fill="#64748b" rx="2"><title>{{ n.nom }} : {{ n.total }} mouvement(s) à l'arrivée</title></rect>
            <text x="608" [attr.y]="n.y + n.h / 2" dominant-baseline="middle" font-size="13" fill="#1e293b">{{ n.nom }} ({{ n.total }})</text>
          </g>
        </svg>
      </app-analyse-bloc>
    </ng-container>
  `
})
export class AnalysesOngletComponent implements OnChanges {
  @Input({ required: true }) periodeId!: number;
  @Input({ required: true }) programmeId!: number;
  @Input({ required: true }) planId!: number;
  @Input() base: string | null = null;

  private service = inject(AnalysesService);

  a: Analyses | null = null;
  chargement = false;
  erreur = '';
  momentCarte: 'avant' | 'apres' = 'apres';
  readonly statuts = Object.values(COULEURS_STATUT);

  echelleMsd = 6;
  echelleTronquee = false;
  private index = new Map<string, Cellule>();

  hauteurSankey = 200;
  noeudsSources: NoeudFlux[] = [];
  noeudsCibles: NoeudFlux[] = [];
  liensSankey: LienFlux[] = [];
  lectureFlux: Interpretation | null = null;

  ngOnChanges(_: SimpleChanges): void {
    if (!this.periodeId || !this.programmeId || !this.planId) return;
    this.chargement = true;
    this.erreur = '';
    this.service.analyses(this.periodeId, this.programmeId, this.planId, this.base).subscribe({
      next: (a) => { this.preparer(a); this.a = a; this.chargement = false; },
      error: (e) => {
        this.chargement = false;
        this.a = null;
        this.erreur = e?.error?.message ?? 'Impossible de calculer les analyses.';
      }
    });
  }

  private preparer(a: Analyses): void {
    this.index.clear();
    for (const c of a.matrice.cellules) this.index.set(c.siteId + '_' + c.produitId, c);
    // Échelle commune des boîtes : jusqu'au plus grand 3e quartile × 1,5, entre 3 et 24 mois
    const q3 = Math.max(0, ...a.dispersion.produits.flatMap(p => [p.avant.q3, p.apres.q3]));
    const max = Math.max(0, ...a.dispersion.produits.flatMap(p => [p.avant.max, p.apres.max]));
    this.echelleMsd = Math.min(24, Math.max(3, Math.ceil(Math.min(max, q3 * 1.5))));
    this.echelleTronquee = max > this.echelleMsd;
    this.construireSankey(a.flux);
  }

  // ── Matrice ───────────────────────────────────────────────────────────────
  cellule(siteId: number, produitId: number): Cellule | undefined {
    return this.index.get(siteId + '_' + produitId);
  }

  couleur(statut: string) {
    return COULEURS_STATUT[statut] ?? { fond: '#e2e8f0', texte: '#1e293b', libelle: statut };
  }

  infoCellule(site: string, produit: string, c: Cellule): string {
    const f = (v: number | null) => v === null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return `${site} — ${produit} : MSD ${f(c.msdAvant)} (${this.couleur(c.statutAvant).libelle}) → ${f(c.msdApres)} (${this.couleur(c.statutApres).libelle})`;
  }

  // ── Dispersion ────────────────────────────────────────────────────────────
  x(v: number): number {
    return Math.max(0, Math.min(600, v / this.echelleMsd * 600));
  }

  largeurBoite(b: Boite): number {
    return Math.max(1.5, this.x(b.q3) - this.x(b.q1));
  }

  verdictDispersion(v: string) {
    const m: Record<string, { fond: string; texte: string; libelle: string }> = {
      NET:            { fond: 'rgba(22,163,74,.15)',  texte: '#15803d', libelle: 'Équilibrage net' },
      MODERE:         { fond: 'rgba(202,138,4,.15)',  texte: '#a16207', libelle: 'Équilibrage modéré' },
      SANS_EFFET:     { fond: 'rgba(100,116,139,.12)', texte: '#475569', libelle: 'Sans effet' },
      DESEQUILIBRE:   { fond: 'rgba(220,38,38,.12)',  texte: '#b91c1c', libelle: 'Déséquilibre' },
      DEJA_EQUILIBRE: { fond: 'rgba(79,70,229,.12)',  texte: '#3730a3', libelle: 'Déjà équilibré' }
    };
    return m[v] ?? { fond: '#e2e8f0', texte: '#1e293b', libelle: v };
  }

  // ── Divers ────────────────────────────────────────────────────────────────
  verdictFiabilite(v: string) {
    if (v === 'BONNE') return { fond: '#16a34a', libelle: 'Bonne' };
    if (v === 'MOYENNE') return { fond: '#ca8a04', libelle: 'Moyenne' };
    return { fond: '#dc2626', libelle: 'Faible' };
  }

  pourcent(v: number, total: number): number {
    if (!total) return 0;
    return Math.max(2, Math.min(100, v / total * 100));
  }

  joursAvant(date: string): number {
    return Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  }

  points(n: number): string {
    return '●'.repeat(Math.max(0, n));
  }

  // ── Flux entre districts (diagramme de Sankey) ────────────────────────────
  private construireSankey(flux: Flux[]): void {
    this.noeudsSources = [];
    this.noeudsCibles = [];
    this.liensSankey = [];
    this.lectureFlux = null;
    if (!flux.length) return;

    const total = flux.reduce((s, f) => s + f.nbMouvements, 0);
    const somme = (cle: 'districtSource' | 'districtCible') => {
      const m = new Map<string, number>();
      for (const f of flux) m.set(f[cle] || 'Sans district', (m.get(f[cle] || 'Sans district') ?? 0) + f.nbMouvements);
      return [...m.entries()].sort((x, y) => y[1] - x[1]);
    };
    const sources = somme('districtSource'), cibles = somme('districtCible');
    const ecart = 14, minH = 6;
    const n = Math.max(sources.length, cibles.length);
    const hauteurUtile = Math.max(160, n * 34);
    const k = (hauteurUtile - ecart * (n - 1)) / total;
    this.hauteurSankey = hauteurUtile + 20;

    const placer = (liste: [string, number][], couleurs: boolean): NoeudFlux[] => {
      const hTotal = liste.reduce((s, [, v]) => s + Math.max(minH, v * k), 0) + ecart * (liste.length - 1);
      let y = 10 + (hauteurUtile - hTotal) / 2;
      return liste.map(([nom, v], i) => {
        const h = Math.max(minH, v * k);
        const noeud = { nom, total: v, y, h, couleur: couleurs ? PALETTE_DISTRICTS[i % PALETTE_DISTRICTS.length] : '#64748b' };
        y += h + ecart;
        return noeud;
      });
    };
    this.noeudsSources = placer(sources, true);
    this.noeudsCibles = placer(cibles, false);

    const parNom = (l: NoeudFlux[]) => new Map(l.map(x => [x.nom, x]));
    const src = parNom(this.noeudsSources), cib = parNom(this.noeudsCibles);
    const decalSrc = new Map<string, number>(), decalCib = new Map<string, number>();
    const ordre = (nom: string, l: NoeudFlux[]) => l.findIndex(x => x.nom === nom);
    const tries = [...flux].sort((f, g) =>
      ordre(f.districtSource || 'Sans district', this.noeudsSources) - ordre(g.districtSource || 'Sans district', this.noeudsSources)
      || ordre(f.districtCible || 'Sans district', this.noeudsCibles) - ordre(g.districtCible || 'Sans district', this.noeudsCibles));
    for (const f of tries) {
      const s = src.get(f.districtSource || 'Sans district')!, c = cib.get(f.districtCible || 'Sans district')!;
      const largeur = Math.max(1.5, f.nbMouvements * k);
      const ys = s.y + (decalSrc.get(s.nom) ?? 0) + largeur / 2;
      const yc = c.y + (decalCib.get(c.nom) ?? 0) + largeur / 2;
      decalSrc.set(s.nom, (decalSrc.get(s.nom) ?? 0) + largeur);
      decalCib.set(c.nom, (decalCib.get(c.nom) ?? 0) + largeur);
      this.liensSankey.push({
        d: `M212,${ys} C400,${ys} 400,${yc} 588,${yc}`,
        largeur, couleur: s.couleur,
        titre: `${s.nom} → ${c.nom} : ${f.nbMouvements} mouvement(s), ${f.nbProduits} produit(s)`
      });
    }

    // Lecture
    const internes = flux.filter(f => f.districtSource === f.districtCible).reduce((s, f) => s + f.nbMouvements, 0);
    const principal = [...flux].sort((f, g) => g.nbMouvements - f.nbMouvements)[0];
    const pct = (v: number) => Math.round(v / total * 100);
    const lecture = [
      `${total} mouvement(s) entre ${sources.length} district(s) de départ et ${cibles.length} district(s) d'arrivée ; ${pct(internes)} % restent à l'intérieur d'un même district.`,
      `Flux principal : ${principal.districtSource || 'Sans district'} → ${principal.districtCible || 'Sans district'}, ${principal.nbMouvements} mouvement(s) (${pct(principal.nbMouvements)} %) portant sur ${principal.nbProduits} produit(s).`
    ];
    const aFaire: string[] = [];
    if (principal.districtSource !== principal.districtCible && pct(principal.nbMouvements) >= 40) {
      aFaire.push(`Organiser un transport groupé ${principal.districtSource} → ${principal.districtCible} : ce trajet concentre ${pct(principal.nbMouvements)} % des mouvements.`);
    }
    this.lectureFlux = { lecture, aFaire };
  }
}
