import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Interpretation } from '../../core/services/analyses.service';

/**
 * Bloc d'une analyse : titre, explication repliable (« Ce que montre cette analyse »),
 * visualisation (contenu projeté), lecture calculée et actions « À faire ».
 *
 *   <app-analyse-bloc titre="…" icone="…" [interpretation]="…">
 *     <div explication>…</div>
 *     …visualisation…
 *   </app-analyse-bloc>
 */
@Component({
  selector: 'app-analyse-bloc',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  styles: [`
    :host { display:block; border:1px solid var(--border-color); border-radius:.6rem; background:var(--surface-color, #fff);
            margin-bottom:1.25rem; overflow:hidden; }
    .entete { display:flex; align-items:center; gap:.5rem; padding:.8rem 1rem; border-bottom:1px solid var(--border-color);
              background:rgba(79,70,229,.04); }
    .entete h3 { margin:0; font-size:.95rem; flex:1; }
    .entete mat-icon { color:var(--accent-color); }
    details { padding:.6rem 1rem; border-bottom:1px solid var(--border-color); font-size:.83rem; color:var(--text-secondary); }
    summary { cursor:pointer; font-weight:600; color:var(--text-primary); font-size:.8rem; list-style:none; display:flex; align-items:center; gap:.3rem; }
    summary::-webkit-details-marker { display:none; }
    summary mat-icon { font-size:18px; width:18px; height:18px; transition:transform .15s; }
    details[open] summary mat-icon { transform:rotate(90deg); }
    .explication { margin-top:.45rem; line-height:1.55; }
    .visuel { padding:1rem; overflow-x:auto; }
    .interpretation { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:.75rem; padding:0 1rem 1rem; }
    .lecture, .afaire { border-radius:.45rem; padding:.7rem .9rem; font-size:.84rem; line-height:1.5; }
    .lecture { background:#eef2ff; border:1px solid #c7d2fe; }
    .afaire { background:#fff7ed; border:1px solid #fed7aa; }
    .titre { display:flex; align-items:center; gap:.35rem; font-weight:700; font-size:.72rem; text-transform:uppercase;
             letter-spacing:.05em; margin-bottom:.35rem; }
    .lecture .titre { color:#3730a3; }
    .afaire .titre { color:#9a3412; }
    .titre mat-icon { font-size:16px; width:16px; height:16px; }
    ul { margin:0; padding-left:1.1rem; }
    li + li { margin-top:.25rem; }
  `],
  template: `
    <div class="entete">
      <mat-icon>{{ icone }}</mat-icon>
      <h3>{{ titre }}</h3>
    </div>
    <details [open]="explicationOuverte">
      <summary><mat-icon>chevron_right</mat-icon> Ce que montre cette analyse</summary>
      <div class="explication"><ng-content select="[explication]"></ng-content></div>
    </details>
    <div class="visuel"><ng-content></ng-content></div>
    <div class="interpretation" *ngIf="interpretation">
      <div class="lecture" *ngIf="interpretation.lecture.length">
        <div class="titre"><mat-icon>insights</mat-icon> Lecture</div>
        <ul><li *ngFor="let l of interpretation.lecture">{{ l }}</li></ul>
      </div>
      <div class="afaire" *ngIf="interpretation.aFaire.length">
        <div class="titre"><mat-icon>task_alt</mat-icon> À faire</div>
        <ul><li *ngFor="let a of interpretation.aFaire">{{ a }}</li></ul>
      </div>
    </div>
  `
})
export class AnalyseBlocComponent {
  @Input({ required: true }) titre = '';
  @Input() icone = 'analytics';
  @Input() interpretation: Interpretation | null = null;
  @Input() explicationOuverte = false;
}
