import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface BoutiqueFavoriteItem {
  id: number;
  titre: string;
  categorie: string;
  prix: number;
  icone: string;
}

const STORAGE_KEY = 'ub_boutique_favoris';

@Injectable({ providedIn: 'root' })
export class BoutiqueFavoritesService {

  private itemsSubject = new BehaviorSubject<BoutiqueFavoriteItem[]>(this.lire());
  items$ = this.itemsSubject.asObservable();

  private lire(): BoutiqueFavoriteItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private ecrire(items: BoutiqueFavoriteItem[]): void {
    this.itemsSubject.next(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  get items(): BoutiqueFavoriteItem[] {
    return this.itemsSubject.value;
  }

  get count(): number {
    return this.items.length;
  }

  estFavori(id: number): boolean {
    return this.items.some(i => i.id === id);
  }

  toggle(produit: BoutiqueFavoriteItem): void {
    if (this.estFavori(produit.id)) {
      this.ecrire(this.items.filter(i => i.id !== produit.id));
    } else {
      this.ecrire([...this.items, produit]);
    }
  }

  supprimer(id: number): void {
    this.ecrire(this.items.filter(i => i.id !== id));
  }

  vider(): void {
    this.ecrire([]);
  }
}
