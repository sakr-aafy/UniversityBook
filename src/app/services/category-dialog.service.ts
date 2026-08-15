import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TypeCategorie } from './admin-categories.service';

export interface CategoryDialogEtat {
  ouvert: boolean;
  type: TypeCategorie;
}

/**
 * Pilote le dialogue de gestion des catégories (voir shared/category-dialog), ouvert depuis
 * les formulaires Documents/Produits — même architecture que ConfirmDialogService (singleton,
 * rendu une fois dans app.component.html). Contrairement à ConfirmDialogService, ce n'est pas
 * une porte oui/non : l'appelant se contente d'observer `etat$` pour savoir quand recharger sa
 * propre liste de catégories après une fermeture.
 */
@Injectable({ providedIn: 'root' })
export class CategoryDialogService {
  private etatSubject = new BehaviorSubject<CategoryDialogEtat>({ ouvert: false, type: 'documents' });
  etat$ = this.etatSubject.asObservable();

  ouvrir(type: TypeCategorie): void {
    this.etatSubject.next({ ouvert: true, type });
  }

  fermer(): void {
    this.etatSubject.next({ ...this.etatSubject.value, ouvert: false });
  }
}
