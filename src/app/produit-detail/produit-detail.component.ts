import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CatalogueService, Produit, VarianteCouleur, VarianteFormat } from '../services/catalogue.service';
import { CartService } from '../services/cart.service';
import { BoutiqueFavoritesService } from '../services/boutique-favorites.service';
import { DocumentsService } from '../services/documents.service';
import { AuthService } from '../services/auth.service';
import { photoUrl } from '../shared/photo-url.util';

type Onglet = 'description' | 'caracteristiques' | 'complementaires' | 'avis' | 'similaires';

@Component({
  selector: 'app-produit-detail',
  templateUrl: './produit-detail.component.html',
  styleUrls: ['./produit-detail.component.css']
})
export class ProduitDetailComponent implements OnInit, OnDestroy {

  produit: Produit | null = null;
  /** Vrai le temps d'attendre le premier chargement du catalogue (lien direct/rafraîchissement) — voir CatalogueService.pret$. */
  chargementProduit: boolean = false;
  private paramSub!: Subscription;
  private pretSub!: Subscription;
  private idActuel = 0;

  imageActive = 0;
  couleurSelectionnee: VarianteCouleur | null = null;
  formatSelectionne: VarianteFormat | null = null;
  /** Unité de vente active — 'pack' seulement si le produit a une config pack (voir aPack). */
  unite: 'piece' | 'pack' = 'piece';
  quantite = 1;
  ongletActif: Onglet = 'description';
  partageConfirme = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalogueService: CatalogueService,
    public cartService: CartService,
    private favService: BoutiqueFavoritesService,
    private documentsService: DocumentsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Abonnement conservé pour toute la durée de vie du composant (pas de take(1)) : se
    // redéclenche aussi bien au premier chargement à froid qu'au rafraîchissement silencieux
    // déclenché ci-dessous, pour refléter les modifications admin (images, prix, variantes...)
    // sans que l'utilisateur ait besoin de recharger la page.
    this.pretSub = this.catalogueService.pret$.pipe(filter(pret => pret)).subscribe(() => {
      this.chargementProduit = false;
      if (this.idActuel) this.assignerProduit(this.idActuel);
    });

    this.paramSub = this.route.paramMap.subscribe(params => {
      this.idActuel = Number(params.get('id'));
      this.chargerProduit();
      window.scrollTo(0, 0);
    });

    // Un chargement est déjà en cours (premier lien direct/rafraîchissement) : inutile de
    // dupliquer l'appel réseau, le pretSub ci-dessus captera sa fin.
    if (!this.catalogueService.chargement) {
      this.catalogueService.actualiser();
    }
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.pretSub?.unsubscribe();
  }

  private chargerProduit(): void {
    if (this.catalogueService.chargement) {
      this.chargementProduit = true;
      return;
    }
    this.assignerProduit(this.idActuel);
  }

  private assignerProduit(id: number): void {
    this.produit = this.catalogueService.getById(id) || null;
    this.imageActive = 0;
    this.quantite = 1;
    this.unite = 'piece';
    this.ongletActif = 'description';
    this.couleurSelectionnee = this.produit?.couleurs?.[0] || null;
    this.formatSelectionne = this.produit?.formats?.[0] || null;
  }

  /* ── Galerie (vraies photos produit envoyées par l'admin ; repli sur l'icône stylée
         de la catégorie — mêmes réglages que la Boutique — si aucune image n'est renseignée) ── */

  get aDesImages(): boolean {
    return !!this.produit?.images?.length;
  }

  get galerie(): number[] {
    return this.produit?.images?.length ? this.produit.images.map((_, i) => i) : [];
  }

  imageUrl(i: number): string {
    return photoUrl(this.produit?.images?.[i]);
  }

  /** Image principale d'un autre produit (carte "Produits similaires"). */
  imagePrincipale(p: Produit): string {
    return photoUrl(p.images?.[0]);
  }

  choisirImage(i: number): void {
    this.imageActive = i;
  }

  /* ── Modal (lightbox) : agrandir l'image active au clic ── */
  modalImageOuvert = false;

  ouvrirModalImage(): void {
    if (this.aDesImages) this.modalImageOuvert = true;
  }

  fermerModalImage(): void {
    this.modalImageOuvert = false;
  }

  imageModalPrecedente(): void {
    if (!this.galerie.length) return;
    this.imageActive = (this.imageActive - 1 + this.galerie.length) % this.galerie.length;
  }

  imageModalSuivante(): void {
    if (!this.galerie.length) return;
    this.imageActive = (this.imageActive + 1) % this.galerie.length;
  }

  @HostListener('document:keydown.escape')
  onEscapeModalImage(): void {
    if (this.modalImageOuvert) this.fermerModalImage();
  }

  /* ── Divers / formatage ── */

  formatPrix(v: number): string {
    return this.catalogueService.formatPrix(v);
  }

  reference(p: { id: number }): string {
    return this.catalogueService.reference(p);
  }

  pourcentagePromo(p: Produit): number {
    return this.catalogueService.pourcentagePromo(p);
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  trackByValue(_index: number, item: number): number {
    return item;
  }

  trackByNom(_index: number, item: { nom: string }): string {
    return item.nom;
  }

  /* ── Variantes (fournitures) ── */

  selectCouleur(c: VarianteCouleur): void {
    this.couleurSelectionnee = c;
  }

  selectFormat(f: VarianteFormat): void {
    this.formatSelectionne = f;
  }

  /** Affiche-t-on le sélecteur Pièce / Pack ? Pour toute fourniture ayant un prix (le bouton
   *  Pack peut y être désactivé, voir packDisponible). */
  get montreUnite(): boolean {
    return this.produit?.domaine === 'fournitures' && (this.produit?.prix || 0) > 0;
  }

  /** Vente au pack réellement possible : nombre de pièces/pack ET prix pack connus en base
   *  (fiche produit caisse). Sinon le bouton Pack est désactivé. */
  get packDisponible(): boolean {
    return !!this.produit?.packNbPieces && !!this.produit?.packPrix;
  }

  /** Alias conservé pour les getters de prix/label ci-dessous. */
  get aPack(): boolean {
    return this.packDisponible;
  }

  choisirUnite(u: 'piece' | 'pack'): void {
    if (this.unite === u) return;
    if (u === 'pack' && !this.packDisponible) return;
    this.unite = u;
    this.quantite = 1;
  }

  get prixAffiche(): number {
    if (!this.produit) return 0;
    // Prix du pack entier (les variantes couleur/format ne s'appliquent pas à la vente par pack).
    if (this.unite === 'pack' && this.aPack) return this.produit.packPrix as number;
    return this.produit.prix + (this.formatSelectionne?.prixDelta || 0);
  }

  get ancienPrixAffiche(): number | undefined {
    if (this.unite === 'pack' && this.aPack) return undefined;
    if (!this.produit?.ancienPrix) return undefined;
    return this.produit.ancienPrix + (this.formatSelectionne?.prixDelta || 0);
  }

  get stockAffiche(): number | null {
    if (!this.produit) return null;
    const stocks = [this.produit.stock, this.couleurSelectionnee?.stock, this.formatSelectionne?.stock]
      .filter((s): s is number => s !== undefined && s !== null);
    if (!stocks.length) return null;
    const base = Math.min(...stocks);
    // Stock exprimé en packs quand la vente par pack est active ET que le nombre de pièces/pack
    // est connu (le stock reste compté en pièces).
    if (this.unite === 'pack' && this.aPack && (this.produit.packNbPieces ?? 0) > 0) {
      return Math.floor(base / (this.produit.packNbPieces as number));
    }
    return base;
  }

  get estDisponible(): boolean {
    if (this.produit?.disponible === false) return false;
    return this.stockAffiche === null || this.stockAffiche > 0;
  }

  get etatStock(): 'en-stock' | 'rupture' {
    return this.estDisponible ? 'en-stock' : 'rupture';
  }

  get varianteLabel(): string | undefined {
    const nbPieces = this.produit?.packNbPieces ?? 0;
    const parts = [
      this.unite === 'pack' && this.aPack ? (nbPieces > 0 ? `Pack de ${nbPieces}` : 'Pack') : null,
      this.couleurSelectionnee?.nom,
      this.formatSelectionne?.nom
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }

  /* ── Quantité ── */

  incrementerQuantite(): void {
    if (this.stockAffiche !== null && this.quantite >= this.stockAffiche) return;
    this.quantite++;
  }

  decrementerQuantite(): void {
    if (this.quantite > 1) this.quantite--;
  }

  /* ── Actions ── */

  ajouterAuPanier(): void {
    if (!this.produit || !this.estDisponible) return;
    this.cartService.ajouter({
      id: this.produit.id,
      titre: this.produit.titre,
      categorie: this.produit.categorie,
      prix: this.prixAffiche,
      icone: this.produit.icone,
      image: this.aDesImages ? this.imageUrl(0) : undefined,
      variante: this.varianteLabel,
      estDocument: this.produit.domaine === 'documents',
      produitId: this.produit.id,
      type: this.produit.type,
      auteur: this.produit.auteur
    }, this.quantite);
  }

  acheterMaintenant(): void {
    this.ajouterAuPanier();
    this.router.navigate(['/panier'], { queryParams: { checkout: 1 } });
  }

  get estDocumentGratuit(): boolean {
    return this.produit?.domaine === 'documents' && !!this.produit?.gratuit;
  }

  /** Documents numériques gratuits : accès immédiat dans Mes Documents (fenêtre 24h), sans panier. */
  telechargerGratuitement(): void {
    if (!this.produit) return;
    if (!this.authService.isConnecte) {
      this.router.navigate(['/login']);
      return;
    }
    const p = this.produit;
    this.documentsService.acquerirGratuit({
      titre: p.titre,
      image: p.icone,
      categorie: p.categorie,
      type: p.type,
      auteur: p.auteur,
      produitId: p.id
    }).subscribe({
      next: () => this.router.navigate(['/user/documents']),
      error: () => {}
    });
  }

  estFavori(id: number): boolean {
    return this.favService.estFavori(id);
  }

  toggleFavori(): void {
    if (!this.produit) return;
    const p = this.produit;
    this.favService.toggle({ id: p.id, titre: p.titre, categorie: p.categorie, prix: p.prix, icone: p.icone });
  }

  partager(): void {
    const url = window.location.href;
    const nav = navigator as Navigator & { share?: (data: { title?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      nav.share({ title: this.produit?.titre, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(() => {
      this.partageConfirme = true;
      setTimeout(() => this.partageConfirme = false, 2000);
    });
  }

  /* ── Onglets ── */

  changerOnglet(o: Onglet): void {
    this.ongletActif = o;
  }

  /* ── Champs dynamiques selon le domaine ── */

  get champsDocument(): { label: string; value: string }[] {
    const p = this.produit;
    if (!p) return [];
    const champs: [string, unknown][] = [
      ['Auteur', p.auteur],
      ['Éditeur', p.editeur],
      ['Année', p.annee],
      ['Faculté', p.faculte],
      ['Filière', p.filiere],
      ['Semestre', p.semestre],
      ['Matière', p.matiereEnseignee],
      ['Nombre de pages', p.nombrePages],
      ['Langue', p.langue],
      ['Format', p.formatDocument],
      ['Type de document', p.type],
    ];
    return this.champsRenseignes(champs);
  }

  get champsFourniture(): { label: string; value: string }[] {
    const p = this.produit;
    if (!p) return [];
    const champs: [string, unknown][] = [
      ['Type', p.type],
      ['Marque', p.marque],
      ['Dimensions', p.dimensions],
      ['Poids', p.poids],
      ['Matière', p.matiereComposition],
      ['Garantie', p.garantie],
      ['Compatible avec', p.compatibleAvec],
      ['Contenu du pack', p.contenuPack],
      ['Unité de vente', p.uniteVente],
    ];
    return this.champsRenseignes(champs);
  }

  get informationsComplementaires(): { label: string; value: string }[] {
    const p = this.produit;
    if (!p) return [];
    const champs: [string, unknown][] = [
      ['Référence', this.reference(p)],
      ['SKU', p.sku],
      ['Code-barres', p.codeBarres],
      ['Catégorie', p.categorie],
      ['Sous-catégorie', p.sousCategorie],
    ];
    return this.champsRenseignes(champs);
  }

  private champsRenseignes(champs: [string, unknown][]): { label: string; value: string }[] {
    return champs
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  /* ── Produits similaires (même sous-catégorie, sinon même catégorie, sinon même domaine —
         produit courant exclu) ── */

  get produitsSimilaires(): Produit[] {
    if (!this.produit) return [];
    const p = this.produit;
    const autres = this.catalogueService.produits.filter(x => x.id !== p.id);

    if (p.sousCategorie) {
      const memeSousCategorie = autres.filter(x => x.sousCategorie === p.sousCategorie);
      if (memeSousCategorie.length > 0) return memeSousCategorie.slice(0, 6);
    }

    const memeCategorie = autres.filter(x => x.categorie === p.categorie);
    if (memeCategorie.length > 0) return memeCategorie.slice(0, 6);

    return autres.filter(x => x.domaine === p.domaine).slice(0, 6);
  }

  ajouterAuPanierRapide(p: Produit): void {
    this.cartService.ajouter({
      id: p.id, titre: p.titre, categorie: p.categorie, prix: p.prix, icone: p.icone,
      image: p.images?.length ? this.imagePrincipale(p) : undefined,
      estDocument: p.domaine === 'documents', produitId: p.id, type: p.type, auteur: p.auteur
    });
  }
}
