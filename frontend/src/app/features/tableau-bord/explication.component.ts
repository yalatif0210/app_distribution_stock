import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Explication repliable placée sous le titre d'un graphique du tableau de bord. */
@Component({
  selector: 'app-explication',
  standalone: true,
  imports: [MatIconModule],
  styles: [`
    details { margin:-.25rem 0 .9rem; font-size:.8rem; color:var(--text-secondary); background:#f8fafc;
              border:1px solid var(--border-color); border-radius:.45rem; padding:.45rem .75rem; }
    summary { cursor:pointer; font-weight:600; color:var(--text-primary); list-style:none; display:flex; align-items:center; gap:.3rem; }
    summary::-webkit-details-marker { display:none; }
    summary mat-icon { font-size:18px; width:18px; height:18px; transition:transform .15s; color:var(--accent-color); }
    details[open] summary mat-icon { transform:rotate(90deg); }
    .texte { margin-top:.4rem; line-height:1.55; }
  `],
  template: `
    <details>
      <summary><mat-icon>chevron_right</mat-icon> {{ titre }}</summary>
      <div class="texte"><ng-content></ng-content></div>
    </details>
  `
})
export class ExplicationComponent {
  @Input() titre = 'Ce que montre ce graphique';
}
