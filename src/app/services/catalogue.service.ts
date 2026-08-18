import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';

export type Domaine = 'documents' | 'fournitures';

export interface VarianteCouleur {
  nom: string;
  hex: string;
  stock: number;
}

export interface VarianteFormat {
  nom: string;
  prixDelta: number;
  stock: number;
}

export interface Produit {
  id: number;
  titre: string;
  domaine: Domaine;
  categorie: string;
  sousCategorie?: string;
  sousSousCategorie?: string;
  prix: number;
  gratuit: boolean;
  type: string;
  sku: string;
  icone: string;
  iconeBg: string;
  badge?: string;
  nouveaute?: boolean;
  populaire?: boolean;
  ancienPrix?: number;
  disponible?: boolean;
  /** Note moyenne (sur 5) et nombre d'avis, à titre indicatif — démonstration. */
  note?: number;
  nombreAvis?: number;

  /* ── Communs ── */
  marque?: string;
  codeBarres?: string;
  stock?: number;
  images?: string[];
  description?: string;

  /* ── Spécifique Documents ── */
  auteur?: string;
  editeur?: string;
  annee?: number;
  faculte?: string;
  filiere?: string;
  semestre?: string;
  matiereEnseignee?: string;
  nombrePages?: number;
  langue?: string;
  formatDocument?: 'Papier' | 'PDF';
  apercuDisponible?: boolean;

  /* ── Spécifique Fournitures scolaires ── */
  couleurs?: VarianteCouleur[];
  formats?: VarianteFormat[];
  dimensions?: string;
  poids?: string;
  matiereComposition?: string;
  garantie?: string;
  compatibleAvec?: string;
  contenuPack?: string;
  uniteVente?: 'Pièce' | 'Pack';
}

/** Forme brute renvoyée par GET /api/catalogue/produits — voir backend/controllers/catalogue.controller.js. */
interface ProduitApi {
  _id: string;
  titre: string;
  description?: string;
  categorie?: string;
  sousCategorie?: string;
  sousSousCategorie?: string;
  type?: string;
  prix: number;
  stock?: number;
  image?: string;
  sku?: string;
  marque?: string;
  codeBarres?: string;
  images?: string[];
  couleurs?: VarianteCouleur[];
  formats?: VarianteFormat[];
  ancienPrix?: number;
  badge?: string;
  nouveaute?: boolean;
  populaire?: boolean;
  note?: number;
  nombreAvis?: number;
  disponible?: boolean;
  categorieIcone?: string;
  categorieCouleur?: string;
}

/** Forme brute renvoyée par GET /api/catalogue/documents. */
interface DocumentApi extends Omit<ProduitApi, 'stock'> {
  gratuit?: boolean;
  auteur?: string;
  editeur?: string;
  annee?: number;
  faculte?: string;
  filiere?: string;
  semestre?: string;
  matiereEnseignee?: string;
  nombrePages?: number;
  langue?: string;
  formatDocument?: string;
  apercuDisponible?: boolean;
}

export interface SousCategorieArbre {
  _id: string;
  nom: string;
}

/** Forme renvoyée par GET /api/catalogue/categories — catégorie réelle avec ses
 *  sous-catégories actives déjà rattachées (jointure faite côté backend). Alimente aussi
 *  bien le mega-menu du Header que les filtres. */
export interface CategorieArbre {
  _id: string;
  nom: string;
  description: string;
  icone: string;
  couleur: string;
  image: string;
  type: Domaine;
  ordre: number;
  actif: boolean;
  sousCategories: SousCategorieArbre[];
}

const ICONE_DEFAUT: Record<Domaine, { icone: string; iconeBg: string }> = {
  documents: { icone: 'fa-book', iconeBg: '#EFF6FF' },
  fournitures: { icone: 'fa-box', iconeBg: '#F5F3FF' }
};

@Injectable({ providedIn: 'root' })
export class CatalogueService {

  /**
   * Catalogue réel (Produit/DocumentCatalogue backend), chargé de façon asynchrone à la
   * construction du service. Propriété publique synchrone conservée à l'identique (les
   * consommateurs — Boutique, Fiche produit — filtrent/trient déjà tout côté client sur ce
   * tableau) : ils n'ont besoin d'aucun changement, seule une réassignation se produit une
   * fois le chargement terminé.
   */
  produits: Produit[] = [];
  /** Arbre catégories → sous-catégories réel (Header mega-menu, formulaires admin en cascade). */
  categories: CategorieArbre[] = [];
  chargement: boolean = true;
  erreurChargement: string = '';

  private pretSubject = new BehaviorSubject<boolean>(false);
  /** Émet `true` une fois le premier chargement terminé (succès ou échec) — à utiliser pour
   *  différer un `getById()` sur un chargement à froid (lien direct/rafraîchissement). */
  pret$ = this.pretSubject.asObservable();

  constructor(private http: HttpClient) {
    this.charger();
  }

  /**
   * Recharge le catalogue depuis le backend — appelée à chaque visite de la Boutique
   * (voir boutique.component.ts#ngOnInit) pour refléter les changements admin sans qu'aucune
   * modification de code ne soit nécessaire. Ce n'est pas du temps réel/push (aucune
   * infrastructure WebSocket dans ce projet) : les changements apparaissent à la prochaine
   * visite de la page, pas instantanément sur un onglet déjà ouvert.
   */
  actualiser(): void {
    this.charger();
  }

  private charger(): void {
    forkJoin({
      produits: this.http.get<ProduitApi[]>(`${environment.apiUrl}/catalogue/produits`),
      documents: this.http.get<DocumentApi[]>(`${environment.apiUrl}/catalogue/documents`),
      categories: this.http.get<CategorieArbre[]>(`${environment.apiUrl}/catalogue/categories`)
    }).subscribe({
      next: ({ produits, documents, categories }) => {
        this.produits = [
          ...documents.map(d => this.mapDocument(d)),
          ...produits.map(p => this.mapProduit(p))
        ];
        this.categories = categories.map(c => ({ ...c, sousCategories: c.sousCategories || [] }));
        this.chargement = false;
        this.pretSubject.next(true);
      },
      error: () => {
        this.erreurChargement = 'Impossible de charger le catalogue pour le moment.';
        this.chargement = false;
        this.pretSubject.next(true);
      }
    });
  }

  private mapProduit(p: ProduitApi): Produit {
    const defaut = ICONE_DEFAUT.fournitures;
    return {
      id: this.hashId(p._id),
      titre: p.titre || '',
      domaine: 'fournitures',
      categorie: p.categorie || '',
      sousCategorie: p.sousCategorie || undefined,
      sousSousCategorie: p.sousSousCategorie || undefined,
      prix: p.prix || 0,
      gratuit: (p.prix || 0) === 0,
      type: p.type || '',
      sku: p.sku || '',
      icone: p.categorieIcone || defaut.icone,
      iconeBg: p.categorieCouleur || defaut.iconeBg,
      badge: p.badge || undefined,
      nouveaute: p.nouveaute,
      populaire: p.populaire,
      ancienPrix: p.ancienPrix,
      // Le backend est la seule source de vérité pour la disponibilité (même logique que
      // mapDocument juste en dessous) — le stock n'est qu'informatif ici : un produit publié
      // depuis la caisse doit rester achetable même si son stock caisse n'a pas encore été
      // renseigné/reçu, tant que rien ne l'a explicitement marqué indisponible.
      disponible: p.disponible !== false,
      note: p.note,
      nombreAvis: p.nombreAvis,
      marque: p.marque || undefined,
      codeBarres: p.codeBarres || undefined,
      stock: p.stock,
      // Image principale (p.image, "Image du produit" en caisse) en premier, suivie de la
      // galerie "Ajouter sur Site Internet" (p.images, voir syncProduitSite.js) — les deux
      // champs sont saisis séparément en caisse et peuvent contenir des photos différentes ; ne
      // garder que la galerie (comme avant) faisait disparaître l'image principale dès qu'une
      // galerie existait. Dédoublonnée si la principale a aussi été ajoutée dans la galerie.
      images: (() => {
        const galerie = (p.images || []).filter(img => img !== p.image);
        const toutes = p.image ? [p.image, ...galerie] : galerie;
        return toutes.length > 0 ? toutes : undefined;
      })(),
      description: p.description || undefined,
      couleurs: p.couleurs && p.couleurs.length > 0 ? p.couleurs : undefined,
      formats: p.formats && p.formats.length > 0 ? p.formats : undefined
    };
  }

  private mapDocument(d: DocumentApi): Produit {
    const defaut = ICONE_DEFAUT.documents;
    return {
      id: this.hashId(d._id),
      titre: d.titre || '',
      domaine: 'documents',
      categorie: d.categorie || '',
      sousCategorie: d.sousCategorie || undefined,
      prix: d.gratuit ? 0 : (d.prix || 0),
      gratuit: !!d.gratuit,
      type: d.type || '',
      sku: d.sku || '',
      icone: d.categorieIcone || defaut.icone,
      iconeBg: d.categorieCouleur || defaut.iconeBg,
      badge: d.badge || (d.gratuit ? 'Gratuit' : undefined),
      nouveaute: d.nouveaute,
      populaire: d.populaire,
      ancienPrix: d.ancienPrix,
      disponible: d.disponible !== false,
      note: d.note,
      nombreAvis: d.nombreAvis,
      images: d.image ? [d.image] : undefined,
      description: d.description || undefined,
      auteur: d.auteur || undefined,
      editeur: d.editeur || undefined,
      annee: d.annee,
      faculte: d.faculte || undefined,
      filiere: d.filiere || undefined,
      semestre: d.semestre || undefined,
      matiereEnseignee: d.matiereEnseignee || undefined,
      nombrePages: d.nombrePages,
      langue: d.langue || undefined,
      formatDocument: (d.formatDocument as 'Papier' | 'PDF') || undefined,
      apercuDisponible: d.apercuDisponible
    };
  }

  /** Hash 32 bits stable (même algorithme que `idDepuisTitre` dans
   *  user/commandes/commandes.component.ts) appliqué au vrai `_id` Mongo : évite de propager
   *  un id de type string dans toute la chaîne panier → commande → document déjà construite
   *  autour d'un `id: number`. Collision négligeable à l'échelle de ce catalogue. */
  private hashId(mongoId: string): number {
    let hash = 0;
    for (let i = 0; i < mongoId.length; i++) {
      hash = (hash * 31 + mongoId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  getById(id: number): Produit | undefined {
    return this.produits.find(p => p.id === id);
  }

  formatPrix(v: number): string {
    if (v === 0) return 'Gratuit';
    return v.toFixed(3).replace('.', ',') + ' د.ت';
  }

  reference(p: { id: number }): string {
    return 'REF-' + String(p.id).padStart(4, '0');
  }

  pourcentagePromo(p: Produit): number {
    if (!p.ancienPrix || p.ancienPrix <= p.prix) return 0;
    return Math.round((1 - p.prix / p.ancienPrix) * 100);
  }
}
