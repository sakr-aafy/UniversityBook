import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../services/cart.service';
import { CompareService } from '../services/compare.service';
import { BoutiqueFavoritesService } from '../services/boutique-favorites.service';
import { CatalogueService, Domaine, Produit } from '../services/catalogue.service';
import { DocumentsService } from '../services/documents.service';
import { AuthService } from '../services/auth.service';
import { photoUrl } from '../shared/photo-url.util';

interface HeroBannerSlide {
  /** Emplacement attendu pour une future photo (fournitures, livres, documents, étudiants, bureau, études…). */
  image: string;
  /** Dégradé de repli affiché tant que le fichier ci-dessus n'existe pas encore dans assets/images. */
  gradient: string;
}

@Component({
  selector: 'app-boutique',
  templateUrl: './boutique.component.html',
  styleUrls: ['./boutique.component.css']
})
export class BoutiqueComponent implements OnInit, OnDestroy {

  constructor(
    public cartService: CartService,
    private compareService: CompareService,
    private favService: BoutiqueFavoritesService,
    public catalogueService: CatalogueService,
    private documentsService: DocumentsService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  recherche: string = '';
  /** Domaine explicitement choisi (clic sur un onglet, lien du Header, query param `domaine`) —
   *  `null` tant qu'aucun choix explicite n'a été fait, auquel cas `domaineActif` calcule un
   *  repli dynamique (voir le getter ci-dessous) plutôt que de figer "Documents" par défaut,
   *  qui peut être vide alors que Fournitures a du contenu publié (ou l'inverse). */
  private domaineChoisi: Domaine | null = null;

  get domaineActif(): Domaine {
    if (this.domaineChoisi) return this.domaineChoisi;
    if (!this.catalogueService.chargement
        && this.catalogueService.produits.filter(p => p.domaine === 'documents').length === 0
        && this.catalogueService.produits.some(p => p.domaine === 'fournitures')) {
      return 'fournitures';
    }
    return 'documents';
  }
  set domaineActif(d: Domaine) { this.domaineChoisi = d; }

  categorieActive: string = 'Tous';
  sousCategorieActive: string = '';
  sousSousCategorieActive: string = '';
  typeActif: string = 'Tous';
  triActif: string = 'defaut';
  filtreGratuit: boolean = false;
  filtrePayant: boolean = false;
  filtresOuverts: boolean = false;

  // ── Filtres avancés (prix / disponibilité / promotions) ──
  prixMin: number | null = null;
  prixMax: number | null = null;
  filtreDisponibilite: 'tous' | 'stock' | 'rupture' = 'tous';
  filtrePromotion: boolean = false;

  // ── Recherche instantanée (suggestions pendant la saisie) ──
  rechercheFocus: boolean = false;
  private rechercheBlurTimeout: any;

  // ── Panier latéral (drawer, piloté par CartService) ──
  panierOuvert: boolean = false;
  /** Bascule brièvement à true à chaque ajout (nombre d'articles en hausse) pour déclencher
   *  l'animation de rebond/glow sur le panneau et le bouton flottant. */
  panierBump: boolean = false;
  private panierSub!: Subscription;
  private panierCountSub!: Subscription;
  private queryParamsSub!: Subscription;
  private panierBumpTimeout: any;

  // ── Hero banner (slider auto-défilant en haut de la page) ──
  heroSlideActif: number = 0;
  private heroTimer?: ReturnType<typeof setInterval>;

  heroBannerSlides: HeroBannerSlide[] = [
    { image: 'assets/images/hero.jpg', gradient: 'linear-gradient(135deg, #6E1726 0%, #8C2433 55%, #3A0D16 100%)' },
    { image: 'assets/images/hero4.jpg',        gradient: 'linear-gradient(135deg, #14532D 0%, #16A34A 55%, #0A2E1A 100%)' },
  ];

  // ── Pagination ──
  pageActuelle: number = 1;
  taillePage: number = 9;

  /** Catégories réellement présentes dans le catalogue pour le domaine actif (remplace
   *  l'ancienne liste codée en dur — synchronisée avec les catégories gérées par l'admin). */
  get categories(): { nom: string; icone: string; count: number }[] {
    const produitsDomaine = this.produits.filter(p => p.domaine === this.domaineActif);
    const parCategorie = new Map<string, number>();
    produitsDomaine.forEach(p => {
      if (!p.categorie) return;
      parCategorie.set(p.categorie, (parCategorie.get(p.categorie) || 0) + 1);
    });
    const chips = [...parCategorie.entries()].map(([nom, count]) => ({
      nom,
      icone: produitsDomaine.find(p => p.categorie === nom)?.icone || 'fa-tag',
      count
    }));
    return [{ nom: 'Tous', icone: 'fa-grip', count: produitsDomaine.length }, ...chips];
  }

  /** Sous-catégories présentes pour la catégorie actuellement sélectionnée (remplace le
   *  précédent littéral codé en dur `categorieActive === 'Droit'`). */
  get sousCategoriesActives(): string[] {
    if (this.categorieActive === 'Tous') return [];
    const set = new Set<string>();
    this.produits
      .filter(p => p.domaine === this.domaineActif && p.categorie === this.categorieActive && p.sousCategorie)
      .forEach(p => set.add(p.sousCategorie as string));
    return [...set];
  }

  /** Sous-sous-catégories présentes pour la sous-catégorie actuellement sélectionnée — même
   *  principe que sousCategoriesActives, un niveau plus bas. */
  get sousSousCategoriesActives(): string[] {
    if (!this.sousCategorieActive) return [];
    const set = new Set<string>();
    this.produits
      .filter(p => p.domaine === this.domaineActif && p.categorie === this.categorieActive
        && p.sousCategorie === this.sousCategorieActive && p.sousSousCategorie)
      .forEach(p => set.add(p.sousSousCategorie as string));
    return [...set];
  }

  /** Types présents dans le catalogue pour le domaine actif. */
  get typesActifs(): string[] {
    const set = new Set<string>();
    this.produits
      .filter(p => p.domaine === this.domaineActif && p.type)
      .forEach(p => set.add(p.type));
    return ['Tous', ...set];
  }

  options = [
    { val: 'defaut',    label: 'Par défaut'       },
    { val: 'recent',    label: 'Plus récents'      },
    { val: 'populaire', label: 'Plus populaires'   },
    { val: 'prix-asc',  label: 'Prix croissant'    },
    { val: 'prix-desc', label: 'Prix décroissant'  },
  ];

  get produits(): Produit[] {
    return this.catalogueService.produits;
  }

  get produitsFiltres(): Produit[] {
    let res = this.produits.filter(p => p.domaine === this.domaineActif);

    if (this.categorieActive !== 'Tous') {
      res = res.filter(p => p.categorie === this.categorieActive);
    }
    if (this.sousCategorieActive) {
      res = res.filter(p => p.sousCategorie === this.sousCategorieActive);
    }
    if (this.sousSousCategorieActive) {
      res = res.filter(p => p.sousSousCategorie === this.sousSousCategorieActive);
    }
    if (this.typeActif !== 'Tous') {
      res = res.filter(p => p.type === this.typeActif);
    }
    if (this.filtreGratuit) {
      res = res.filter(p => p.gratuit);
    }
    if (this.filtrePayant) {
      res = res.filter(p => !p.gratuit);
    }
    if (this.prixMin !== null) {
      res = res.filter(p => p.prix >= (this.prixMin as number));
    }
    if (this.prixMax !== null) {
      res = res.filter(p => p.prix <= (this.prixMax as number));
    }
    if (this.filtreDisponibilite === 'stock') {
      res = res.filter(p => p.disponible !== false);
    } else if (this.filtreDisponibilite === 'rupture') {
      res = res.filter(p => p.disponible === false);
    }
    if (this.filtrePromotion) {
      res = res.filter(p => this.pourcentagePromo(p) > 0);
    }
    if (this.recherche.trim()) {
      const q = this.recherche.toLowerCase();
      res = res.filter(p =>
        p.titre.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q) ||
        (p.sousCategorie || '').toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        this.reference(p).toLowerCase().includes(q)
      );
    }

    switch (this.triActif) {
      case 'prix-asc':  res = [...res].sort((a, b) => a.prix - b.prix); break;
      case 'prix-desc': res = [...res].sort((a, b) => b.prix - a.prix); break;
      case 'populaire': res = [...res].sort((a, b) => +!!b.populaire - +!!a.populaire); break;
      case 'recent':    res = [...res].sort((a, b) => +!!b.nouveaute - +!!a.nouveaute); break;
    }

    return res;
  }

  // ── Domaine (onglets Documents / Fournitures scolaires) ──

  changerDomaine(d: Domaine): void {
    if (this.domaineActif === d) return;
    this.domaineActif = d;
    this.categorieActive = 'Tous';
    this.sousCategorieActive = '';
    this.sousSousCategorieActive = '';
    this.typeActif = 'Tous';
    this.filtreGratuit = false;
    this.filtrePayant = false;
    this.resetPage();
  }

  // ── Pagination ──

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.produitsFiltres.length / this.taillePage));
  }

  get produitsPage(): Produit[] {
    const debut = (this.pageActuelle - 1) * this.taillePage;
    return this.produitsFiltres.slice(debut, debut + this.taillePage);
  }

  get pagesAffichees(): number[] {
    const total = this.totalPages;
    const courante = this.pageActuelle;
    const pages = new Set<number>([1, total, courante, courante - 1, courante + 1]);
    return [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  }

  get pagesAvecEllipses(): (number | '...')[] {
    const result: (number | '...')[] = [];
    let precedent = 0;
    for (const p of this.pagesAffichees) {
      if (precedent && p - precedent > 1) result.push('...');
      result.push(p);
      precedent = p;
    }
    return result;
  }

  allerPage(n: number): void {
    if (n < 1 || n > this.totalPages || n === this.pageActuelle) return;
    this.pageActuelle = n;
    document.getElementById('grille-produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  pagePrecedente(): void { this.allerPage(this.pageActuelle - 1); }
  pageSuivante(): void { this.allerPage(this.pageActuelle + 1); }

  private resetPage(): void {
    this.pageActuelle = 1;
  }

  // ── Recommandés ──

  get produitsRecommandes(): Produit[] {
    return this.produits.filter(p => p.populaire && p.domaine === this.domaineActif);
  }

  // ── Divers ──

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

  trackByStr(_index: number, item: string | { nom: string }): string {
    return typeof item === 'string' ? item : item.nom;
  }

  trackByIndex(index: number): number {
    return index;
  }

  filtrerCategorie(cat: string): void {
    this.categorieActive = cat;
    this.sousCategorieActive = '';
    this.sousSousCategorieActive = '';
    this.resetPage();
  }

  filtrerSousCategorie(sc: string): void {
    this.sousCategorieActive = this.sousCategorieActive === sc ? '' : sc;
    this.sousSousCategorieActive = '';
    this.resetPage();
  }

  filtrerSousSousCategorie(ssc: string): void {
    this.sousSousCategorieActive = this.sousSousCategorieActive === ssc ? '' : ssc;
    this.resetPage();
  }

  filtrerType(t: string): void {
    this.typeActif = t;
    this.resetPage();
  }

  onRechercheChange(): void {
    this.resetPage();
  }

  /** Suggestions instantanées (nom / catégorie / sous-catégorie), tous domaines confondus,
   *  affichées sous la barre de recherche pendant la saisie — s'appuie sur les mêmes champs
   *  que le filtre de recherche principal (produitsFiltres), sans nouvel appel réseau. */
  get suggestionsRecherche(): Produit[] {
    const q = this.recherche.trim().toLowerCase();
    if (!q) return [];
    return this.produits
      .filter(p =>
        p.titre.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q) ||
        (p.sousCategorie || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }

  onRechercheFocus(): void {
    clearTimeout(this.rechercheBlurTimeout);
    this.rechercheFocus = true;
  }

  /** Délai avant fermeture : laisse le temps au clic sur une suggestion de s'enregistrer
   *  avant que le blur ne démonte la liste (même pattern que le mega-menu du Header). */
  onRechercheBlur(): void {
    this.rechercheBlurTimeout = setTimeout(() => (this.rechercheFocus = false), 200);
  }

  choisirSuggestion(p: Produit): void {
    clearTimeout(this.rechercheBlurTimeout);
    this.rechercheFocus = false;
    this.voirDetail(p);
  }

  onTriChange(): void {
    this.resetPage();
  }

  onFiltreGratuitChange(): void {
    this.resetPage();
  }

  onPrixChange(): void {
    this.resetPage();
  }

  filtrerDisponibilite(d: 'tous' | 'stock' | 'rupture'): void {
    this.filtreDisponibilite = this.filtreDisponibilite === d ? 'tous' : d;
    this.resetPage();
  }

  onFiltrePromotionChange(): void {
    this.resetPage();
  }

  reinitialiser(): void {
    this.recherche = '';
    this.categorieActive = 'Tous';
    this.sousCategorieActive = '';
    this.sousSousCategorieActive = '';
    this.typeActif = 'Tous';
    this.triActif = 'defaut';
    this.filtreGratuit = false;
    this.filtrePayant = false;
    this.prixMin = null;
    this.prixMax = null;
    this.filtreDisponibilite = 'tous';
    this.filtrePromotion = false;
    this.resetPage();
  }

  toggleFiltres(): void {
    this.filtresOuverts = !this.filtresOuverts;
  }

  appliquerFiltres(): void {
    this.filtresOuverts = false;
  }

  // ── Panier (drawer) ──

  ajouterPanier(p: Produit): void {
    // CartService.ajouter() gère l'ajout/incrémentation ET l'ouverture automatique du drawer.
    this.cartService.ajouter({
      id: p.id,
      titre: p.titre,
      categorie: p.categorie,
      prix: p.prix,
      icone: p.icone,
      image: p.images?.length ? photoUrl(p.images[0]) : undefined,
      estDocument: p.domaine === 'documents',
      produitId: p.id,
      type: p.type,
      auteur: p.auteur
    });
  }

  /**
   * Documents numériques gratuits : crée directement l'accès dans « Mes Documents »
   * (fenêtre de 24h), sans passer par le panier/la commande.
   */
  telechargerGratuitement(p: Produit): void {
    if (!this.authService.isConnecte) {
      this.router.navigate(['/login']);
      return;
    }
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

  fermerPanier(): void {
    this.cartService.fermerPanier();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panierOuvert) {
      this.fermerPanier();
    }
  }

  // ── Favoris (locaux à la Boutique) ──

  /** Id du produit dont le cœur vient d'être cliqué (bref, pour l'animation de battement). */
  favorisAnimId: number | null = null;
  private favorisAnimTimeout: any;

  estFavori(id: number): boolean {
    return this.favService.estFavori(id);
  }

  toggleFavori(p: Produit): void {
    this.favService.toggle({ id: p.id, titre: p.titre, categorie: p.categorie, prix: p.prix, icone: p.icone });
    this.favorisAnimId = p.id;
    clearTimeout(this.favorisAnimTimeout);
    this.favorisAnimTimeout = setTimeout(() => (this.favorisAnimId = null), 550);
  }

  // ── Visuel carte produit : image réelle si disponible (upload admin), sinon repli
  //    icône + couleur (convention déjà en place dans toute l'application — voir
  //    produit-detail.component). Léger carrousel au survol quand plusieurs images. ──

  private carteImageSurvolee: { id: number; index: number } | null = null;
  private carrouselTimer: any;

  /** URL de l'image actuellement affichée pour cette carte (tient compte du survol/carrousel). */
  imageActuelle(p: Produit): string {
    if (!p.images || p.images.length === 0) return '';
    const index = this.carteImageSurvolee?.id === p.id ? this.carteImageSurvolee.index : 0;
    return photoUrl(p.images[index]);
  }

  indexImageActuel(p: Produit): number {
    return this.carteImageSurvolee?.id === p.id ? this.carteImageSurvolee.index : 0;
  }

  demarrerCarrousel(p: Produit): void {
    if (!p.images || p.images.length <= 1) return;
    this.carteImageSurvolee = { id: p.id, index: 0 };
    clearInterval(this.carrouselTimer);
    this.carrouselTimer = setInterval(() => {
      if (!this.carteImageSurvolee || this.carteImageSurvolee.id !== p.id || !p.images) return;
      this.carteImageSurvolee.index = (this.carteImageSurvolee.index + 1) % p.images.length;
    }, 1100);
  }

  arreterCarrousel(): void {
    clearInterval(this.carrouselTimer);
    this.carteImageSurvolee = null;
  }

  /** Économie réalisée en cas de promotion (montant, pas pourcentage — voir pourcentagePromo()). */
  economie(p: Produit): number {
    if (!p.ancienPrix || p.ancienPrix <= p.prix) return 0;
    return p.ancienPrix - p.prix;
  }

  // ── Comparateur ──

  estEnComparaison(id: number): boolean {
    return this.compareService.estDansComparateur(id);
  }

  toggleComparaison(p: Produit): void {
    this.compareService.toggle({ id: p.id, titre: p.titre, categorie: p.categorie, prix: p.prix, icone: p.icone });
  }

  // ── Bannière promo ──

  decouvrirPromo(): void {
    this.changerDomaine('documents');
    this.filtrerType('Examens');
    document.getElementById('grille-produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Détail produit : navigation vers la page dédiée ──

  voirDetail(p: Produit): void {
    this.router.navigate(['/produit', p.id]);
  }

  // ── Hero banner ──

  private demarrerHeroAutoplay(): void {
    this.heroTimer = setInterval(() => {
      this.heroSlideActif = (this.heroSlideActif + 1) % this.heroBannerSlides.length;
    }, 5500);
  }

  ngOnInit(): void {
    // Recharge le catalogue à chaque visite de la page : reflète les ajouts/modifications/
    // suppressions faits côté admin sans qu'aucun code n'ait besoin d'être changé (pas de
    // push temps réel — voir catalogue.service.ts#actualiser()).
    this.catalogueService.actualiser();

    // Abonnement (pas une simple lecture ponctuelle du snapshot) : Angular ne réinstancie pas
    // ce composant quand seuls les query params changent sur la même route /boutique — un clic
    // sur un lien du mega-menu Header alors qu'on est déjà sur la page ne déclencherait donc
    // jamais ngOnInit. S'abonner à queryParamMap permet de réappliquer les filtres à chaque
    // navigation, y compris depuis la Boutique elle-même.
    this.queryParamsSub = this.route.queryParamMap.subscribe(params => {
      const q = params.get('q');
      const tri = params.get('tri');
      const domaine = params.get('domaine');
      const categorie = params.get('categorie');
      const sousCategorie = params.get('sousCategorie');
      const sousSousCategorie = params.get('sousSousCategorie');
      const gratuit = params.get('gratuit');
      const payant = params.get('payant');
      // Affectation complète (pas changerDomaine()/filtrerCategorie()/filtrerSousCategorie()) :
      // ces méthodes réinitialisent les filtres plus fins, ce qui effacerait un paramètre
      // appliqué juste avant dans cette même chaîne (domaine → catégorie → sous-catégorie →
      // sous-sous-catégorie). Un champ absent de l'URL revient à sa valeur par défaut : un lien
      // du Header remplace entièrement les filtres actifs plutôt que de les cumuler avec un état
      // résiduel.
      this.recherche = q || '';
      this.triActif = tri || 'defaut';
      if (domaine === 'documents' || domaine === 'fournitures') this.domaineActif = domaine;
      this.categorieActive = categorie || 'Tous';
      this.sousCategorieActive = sousCategorie || '';
      this.sousSousCategorieActive = sousSousCategorie || '';
      this.filtreGratuit = gratuit === '1';
      this.filtrePayant = payant === '1';
    });

    this.panierSub = this.cartService.ouvert$.subscribe(ouvert => {
      this.panierOuvert = ouvert;
      // Le blocage du scroll de fond ne concerne que le mode modal plein écran (mobile,
      // <768px) : dès la tablette, le panier est un panneau fixe non bloquant qui doit
      // coexister avec le défilement normal de la page (voir boutique.component.css).
      const estModaleMobile = window.innerWidth < 768;
      document.body.classList.toggle('ub-no-scroll', ouvert && estModaleMobile);
    });

    // Rebond/glow sur le panneau + le bouton flottant à chaque hausse du nombre d'articles
    // (mirroring du pattern `cartBump` déjà utilisé par le header).
    let dernierCompte = this.cartService.count;
    this.panierCountSub = this.cartService.items$.subscribe(() => {
      const nouveauCompte = this.cartService.count;
      if (nouveauCompte > dernierCompte) {
        this.panierBump = true;
        clearTimeout(this.panierBumpTimeout);
        this.panierBumpTimeout = setTimeout(() => (this.panierBump = false), 600);
      }
      dernierCompte = nouveauCompte;
    });

    this.demarrerHeroAutoplay();
  }

  ngOnDestroy(): void {
    this.panierSub?.unsubscribe();
    this.panierCountSub?.unsubscribe();
    this.queryParamsSub?.unsubscribe();
    clearTimeout(this.panierBumpTimeout);
    clearTimeout(this.favorisAnimTimeout);
    clearTimeout(this.rechercheBlurTimeout);
    clearInterval(this.carrouselTimer);
    if (this.heroTimer) clearInterval(this.heroTimer);
    document.body.classList.remove('ub-no-scroll');
  }
}
