import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PanierItem {
  id: number;
  titre: string;
  categorie: string;
  prix: number;
  quantite: number;
  icone: string;
  /** URL de la photo produit (déjà résolue via photoUrl) — absente si le produit n'a pas de vraie photo. */
  image?: string;
  /** Description de la variante sélectionnée (ex. "Rouge / A4"), le cas échéant. */
  variante?: string;
  /**
   * Contexte "document numérique" : permet, à la commande, de créer automatiquement
   * l'accès correspondant dans Mes Documents (voir OrdersService/DocumentsService).
   */
  estDocument?: boolean;
  produitId?: number;
  type?: string;
  auteur?: string;
}

const STORAGE_KEY = 'ub_panier';

@Injectable({ providedIn: 'root' })
export class CartService {

  private itemsSubject = new BehaviorSubject<PanierItem[]>(this.lire());
  items$ = this.itemsSubject.asObservable();

  /** État d'ouverture du panneau panier (drawer), piloté depuis n'importe quel composant (header, boutique…). */
  private ouvertSubject = new BehaviorSubject<boolean>(false);
  ouvert$ = this.ouvertSubject.asObservable();

  get estOuvert(): boolean {
    return this.ouvertSubject.value;
  }

  ouvrirPanier(): void {
    this.ouvertSubject.next(true);
  }

  fermerPanier(): void {
    this.ouvertSubject.next(false);
  }

  togglePanier(): void {
    this.ouvertSubject.next(!this.ouvertSubject.value);
  }

  private lire(): PanierItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private ecrire(items: PanierItem[]): void {
    this.itemsSubject.next(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  get items(): PanierItem[] {
    return this.itemsSubject.value;
  }

  get count(): number {
    return this.items.reduce((acc, i) => acc + i.quantite, 0);
  }

  get total(): number {
    return this.items.reduce((acc, i) => acc + i.prix * i.quantite, 0);
  }

  /** Alias sémantique de `total`, utilisé pour l'affichage du résumé du panier latéral. */
  get sousTotal(): number {
    return this.total;
  }

  ajouter(produit: {
    id: number; titre: string; categorie: string; prix: number; icone: string; image?: string;
    variante?: string; estDocument?: boolean; produitId?: number; type?: string; auteur?: string;
  }, quantite: number = 1): void {
    const items = [...this.items];
    const existant = items.find(i => i.id === produit.id && (i.variante || '') === (produit.variante || ''));
    if (existant) {
      existant.quantite += quantite;
      // Réattache les métadonnées les plus récentes : si cet article était déjà dans le
      // panier (localStorage) avant l'ajout du contexte "document numérique", un simple
      // incrément de quantité laisserait estDocument/produitId/type/auteur manquants et
      // empêcherait la création de l'accès dans Mes Documents à la commande.
      existant.estDocument = produit.estDocument;
      existant.produitId = produit.produitId;
      existant.type = produit.type;
      existant.auteur = produit.auteur;
      existant.image = produit.image;
    } else {
      items.push({ ...produit, quantite });
    }
    this.ecrire(items);
    this.ouvrirPanier();
  }

  incrementer(id: number, variante?: string): void {
    this.ecrire(this.items.map(i =>
      i.id === id && (i.variante || '') === (variante || '') ? { ...i, quantite: i.quantite + 1 } : i
    ));
  }

  decrementer(id: number, variante?: string): void {
    this.ecrire(this.items.map(i =>
      i.id === id && (i.variante || '') === (variante || '') && i.quantite > 1 ? { ...i, quantite: i.quantite - 1 } : i
    ));
  }

  supprimer(id: number, variante?: string): void {
    this.ecrire(this.items.filter(i => !(i.id === id && (i.variante || '') === (variante || ''))));
  }

  vider(): void {
    this.ecrire([]);
  }
}
