import { Component, Injectable, Input } from '@angular/core';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';

/**
 * Pagination d'une liste affichée dans un tableau HTML simple.
 *
 *   pgSites = new Pagination();                       // dans le composant
 *   <tr *ngFor="let s of pgSites.page(sites)">…</tr>  // dans le gabarit
 *   <app-pagination [p]="pgSites" [total]="sites.length"></app-pagination>
 */
export class Pagination {
  index = 0;

  constructor(public taille = 10) {}

  /** Lignes de la page courante ; revient à la dernière page si la liste a raccourci. */
  page<T>(liste: readonly T[] | null | undefined): T[] {
    const l = liste ?? [];
    const derniere = Math.max(0, Math.ceil(l.length / this.taille) - 1);
    if (this.index > derniere) this.index = derniere;
    return l.slice(this.index * this.taille, (this.index + 1) * this.taille);
  }

  changer(e: PageEvent): void {
    this.index = e.pageIndex;
    this.taille = e.pageSize;
  }

  /** À appeler quand la liste change de contenu (filtre, nouveau calcul). */
  premiere(): void {
    this.index = 0;
  }
}

/** Paginateur Material relié à une Pagination. */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [MatPaginatorModule],
  // Liste vide : pas de paginateur (le tableau affiche déjà « aucun… »)
  template: `
    @if (total > 0) {
    <mat-paginator [length]="total" [pageSize]="p.taille" [pageIndex]="p.index" [pageSizeOptions]="options"
                   (page)="p.changer($event)" showFirstLastButtons [attr.aria-label]="libelle"></mat-paginator>
    }
  `
})
export class PaginationComponent {
  @Input({ required: true }) p!: Pagination;
  @Input({ required: true }) total = 0;
  @Input() options: number[] = [10, 25, 50, 100];
  @Input() libelle = 'Pages du tableau';
}

/** Libellés français de tous les paginateurs de l'application. */
@Injectable()
export class PaginatorIntlFr extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Lignes par page';
  override nextPageLabel = 'Page suivante';
  override previousPageLabel = 'Page précédente';
  override firstPageLabel = 'Première page';
  override lastPageLabel = 'Dernière page';
  override getRangeLabel = (page: number, taille: number, total: number): string => {
    if (total === 0 || taille === 0) return `0 sur ${total}`;
    const debut = page * taille;
    const fin = Math.min(debut + taille, total);
    return `${debut + 1} – ${fin} sur ${total}`;
  };
}
