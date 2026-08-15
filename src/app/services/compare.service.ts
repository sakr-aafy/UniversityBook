import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CompareItem {
  id: number;
  titre: string;
  categorie: string;
  prix: number;
  icone: string;
}

const STORAGE_KEY = 'ub_comparateur';

@Injectable({ providedIn: 'root' })
export class CompareService {

  private itemsSubject = new BehaviorSubject<CompareItem[]>(this.lire());
  items$ = this.itemsSubject.asObservable();

  private lire(): CompareItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private ecrire(items: CompareItem[]): void {
    this.itemsSubject.next(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  get items(): CompareItem[] {
    return this.itemsSubject.value;
  }

  get count(): number {
    return this.items.length;
  }

  estDansComparateur(id: number): boolean {
    return this.items.some(i => i.id === id);
  }

  toggle(produit: CompareItem): void {
    if (this.estDansComparateur(produit.id)) {
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
