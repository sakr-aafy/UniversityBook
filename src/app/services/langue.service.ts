import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export type CodeLangue = 'fr' | 'en' | 'ar';

/**
 * Pilote la langue de l'interface (FR / EN / AR) via ngx-translate.
 * - charge le dictionnaire src/assets/i18n/<lang>.json (voir app.module.ts) ;
 * - mémorise le choix dans localStorage ;
 * - pose `lang` et `dir` (rtl pour l'arabe) sur <html> pour la mise en page bidirectionnelle.
 *
 * Migration progressive : chaque libellé en dur d'un template devient
 * `{{ 'cle.de.traduction' | translate }}` et sa valeur est ajoutée aux 3 fichiers JSON.
 */
@Injectable({ providedIn: 'root' })
export class LangueService {
  private static readonly STORAGE = 'ub_langue';
  readonly languesDisponibles: CodeLangue[] = ['fr', 'en', 'ar'];
  private readonly languesRtl: CodeLangue[] = ['ar'];

  private readonly _courante$ = new BehaviorSubject<CodeLangue>('fr');
  /** Langue active (émet à chaque changement). */
  readonly courante$ = this._courante$.asObservable();

  constructor(private translate: TranslateService) {}

  get courante(): CodeLangue {
    return this._courante$.value;
  }

  get estRtl(): boolean {
    return this.languesRtl.includes(this.courante);
  }

  /** À appeler une fois au démarrage (app.component.ts). */
  init(): void {
    this.translate.addLangs(this.languesDisponibles);
    this.translate.setDefaultLang('fr');
    const nav = (this.translate.getBrowserLang() || '').slice(0, 2) as CodeLangue;
    const initiale = this.lireStockee()
      || (this.languesDisponibles.includes(nav) ? nav : 'fr');
    this.definir(initiale);
  }

  definir(code: CodeLangue): void {
    const lang: CodeLangue = this.languesDisponibles.includes(code) ? code : 'fr';
    this.translate.use(lang);
    this._courante$.next(lang);
    try {
      localStorage.setItem(LangueService.STORAGE, lang);
    } catch { /* mode privé / stockage indisponible : on continue sans mémoriser */ }
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', this.languesRtl.includes(lang) ? 'rtl' : 'ltr');
  }

  private lireStockee(): CodeLangue | null {
    try {
      const v = localStorage.getItem(LangueService.STORAGE) as CodeLangue | null;
      return v && this.languesDisponibles.includes(v) ? v : null;
    } catch {
      return null;
    }
  }
}
