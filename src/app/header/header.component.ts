import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../services/cart.service';
import { AuthService, AuthUser } from '../services/auth.service';
import { BoutiqueFavoritesService } from '../services/boutique-favorites.service';
import { NotificationsService, AppNotification } from '../services/notifications.service';
import { ConfirmDialogService } from '../services/confirm-dialog.service';
import { CatalogueService, CategorieArbre } from '../services/catalogue.service';
import { photoUrl } from '../shared/photo-url.util';

export interface SousCategorieFourniture {
  nom: string;
  sousSousCategories: string[];
}

export interface CategorieFourniture {
  nom: string;
  sousCategories: SousCategorieFourniture[];
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  menuOpen: boolean = false;
  searchOpen: boolean = false;
  currentLang: string = 'FR';
  openMenu: string | null = null;
  boutiqueSub: string | null = null;
  boutiqueSubSub: string | null = null;
  cartCount: number = 0;
  cartTotal: string = '0,000';
  cartBump: boolean = false;
  scrolled: boolean = false;
  currentUser: AuthUser | null = null;

  favorisCount: number = 0;

  notifications: AppNotification[] = [];
  notifOuvert: boolean = false;
  private notifSub!: Subscription;

  userMenuOuvert: boolean = false;

  private cartSub!: Subscription;
  private authSub!: Subscription;
  private favSub!: Subscription;
  private bumpTimeout: any;
  private fermetureMenuTimer: any;
  private fermetureSousMenuTimer: any;
  private fermetureSousSousMenuTimer: any;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private favoritesService: BoutiqueFavoritesService,
    private notificationsService: NotificationsService,
    private confirmDialogService: ConfirmDialogService,
    private catalogueService: CatalogueService,
    private router: Router
  ) {}

  get notifNonLues(): number {
    return this.notifications.filter(n => !n.lu).length;
  }

  get photoUrl(): string {
    return photoUrl(this.currentUser?.photo);
  }

  /** Catégories réelles (Category collection), alimentent le mega-menu — plus aucun
   *  contenu codé en dur : ajouter une catégorie/sous-catégorie en admin la fait apparaître
   *  ici automatiquement (au prochain chargement de `catalogueService`). */
  get categoriesDocuments(): CategorieArbre[] {
    return this.catalogueService.categories.filter(c => c.type === 'documents');
  }

  /** Arbre Catégorie > Sous-catégorie > Sous-sous-catégorie construit dynamiquement à partir des
   *  produits réellement publiés (synchronisés depuis la caisse, voir
   *  backend/controllers/syncProduitSite.js) — contrairement à categoriesDocuments ci-dessus, pas
   *  de collection Category dédiée à gérer séparément : n'affiche jamais un lien mort vers une
   *  catégorie sans aucun produit derrière, et se met à jour tout seul dès qu'un produit caisse
   *  est publié/dépublié. */
  get categoriesFournituresArbre(): CategorieFourniture[] {
    const produits = this.catalogueService.produits.filter(p => p.domaine === 'fournitures' && p.categorie);
    const parCategorie = new Map<string, Map<string, Set<string>>>();
    produits.forEach(p => {
      if (!parCategorie.has(p.categorie)) parCategorie.set(p.categorie, new Map());
      if (!p.sousCategorie) return;
      const parSousCategorie = parCategorie.get(p.categorie)!;
      if (!parSousCategorie.has(p.sousCategorie)) parSousCategorie.set(p.sousCategorie, new Set());
      if (p.sousSousCategorie) parSousCategorie.get(p.sousCategorie)!.add(p.sousSousCategorie);
    });
    return [...parCategorie.entries()].map(([nom, parSousCategorie]) => ({
      nom,
      sousCategories: [...parSousCategorie.entries()].map(([sousNom, sousSousSet]) => ({
        nom: sousNom,
        sousSousCategories: [...sousSousSet]
      }))
    }));
  }

  /** Clé combinée catégorie+sous-catégorie pour le flyout de sous-sous-catégories (boutiqueSubSub)
   *  — évite une collision si deux catégories différentes partagent un nom de sous-catégorie. */
  cleSousCategorie(categorieNom: string, sousCategorieNom: string): string {
    return `${categorieNom}::${sousCategorieNom}`;
  }

  /** trackBy indispensables ici : categoriesFournituresArbre est un getter qui reconstruit un
   *  tableau (et des objets) neufs à chaque cycle de détection de changements Angular — sans
   *  trackBy, *ngFor compare par référence, conclut que "tout" a changé à chaque passage de
   *  souris, et détruit/recrée tous les nœuds DOM du mega-menu en continu (flyouts instables,
   *  clics qui semblent ne pas répondre). categoriesDocuments (dérivé d'un .filter() sur un
   *  tableau stable) est moins touché mais suit le même principe par cohérence. */
  trackByNom(_: number, item: { nom: string }): string {
    return item.nom;
  }

  trackByStr(_: number, item: string): string {
    return item;
  }

  ngOnInit(): void {
    this.updateMobile();
    this.cartSub = this.cartService.items$.subscribe(() => {
      const nouveauCompte = this.cartService.count;
      if (nouveauCompte > this.cartCount) {
        this.cartBump = true;
        clearTimeout(this.bumpTimeout);
        this.bumpTimeout = setTimeout(() => this.cartBump = false, 500);
      }
      this.cartCount = nouveauCompte;
      this.cartTotal = this.cartService.total.toFixed(3).replace('.', ',');
    });
    this.favSub = this.favoritesService.items$.subscribe(items => {
      this.favorisCount = items.length;
    });
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.chargerNotifications();
      } else {
        this.notifications = [];
      }
    });
  }

  private chargerNotifications(): void {
    this.notificationsService.list().subscribe({
      next: notifications => (this.notifications = notifications),
      error: () => {}
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 8;
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.favSub?.unsubscribe();
    clearTimeout(this.bumpTimeout);
    clearTimeout(this.fermetureMenuTimer);
    clearTimeout(this.fermetureSousMenuTimer);
    clearTimeout(this.fermetureSousSousMenuTimer);
  }

  @HostListener('window:resize')
  updateMobile(): void {
    this.isMobile = window.innerWidth <= 1080;
    if (!this.isMobile) this.menuOpen = false;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  toggleSearch(): void {
    this.searchOpen = !this.searchOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  setLang(l: string): void {
    this.currentLang = l;
  }

  openDropdown(menu: string): void {
    clearTimeout(this.fermetureMenuTimer);
    this.openMenu = menu;
  }

  /**
   * Fermeture différée (250 ms, annulée si la souris revient via openDropdown/openSub avant
   * l'échéance) : laisse le temps au curseur de traverser le léger espace mort entre le lien
   * et le panneau — ou vers un flyout de sous-catégories — sans fermer le mega-menu par
   * erreur. Comportement standard des menus déroulants e-commerce (Amazon, Shopify…).
   */
  closeDropdowns(): void {
    clearTimeout(this.fermetureMenuTimer);
    this.fermetureMenuTimer = setTimeout(() => {
      this.openMenu = null;
      this.boutiqueSub = null;
    }, 250);
  }

  /** Ferme immédiatement (clic sur un lien, navigation) — pas de délai nécessaire ici. */
  fermerMegaMenu(): void {
    clearTimeout(this.fermetureMenuTimer);
    clearTimeout(this.fermetureSousMenuTimer);
    clearTimeout(this.fermetureSousSousMenuTimer);
    this.openMenu = null;
    this.boutiqueSub = null;
    this.boutiqueSubSub = null;
  }

  openSub(sub: string): void {
    clearTimeout(this.fermetureSousMenuTimer);
    this.boutiqueSub = sub;
  }

  closeSub(): void {
    clearTimeout(this.fermetureSousMenuTimer);
    this.fermetureSousMenuTimer = setTimeout(() => {
      this.boutiqueSub = null;
    }, 250);
  }

  /** Flyout de 3e niveau (sous-sous-catégories), imbriqué dans celui de openSub/closeSub —
   *  même principe de fermeture différée pour laisser le curseur traverser vers le flyout. */
  openSubSub(subSub: string): void {
    clearTimeout(this.fermetureSousSousMenuTimer);
    this.boutiqueSubSub = subSub;
  }

  closeSubSub(): void {
    clearTimeout(this.fermetureSousSousMenuTimer);
    this.fermetureSousSousMenuTimer = setTimeout(() => {
      this.boutiqueSubSub = null;
    }, 250);
  }

  // ── Notifications ──

  toggleNotifications(): void {
    this.notifOuvert = !this.notifOuvert;
    this.userMenuOuvert = false;
  }

  fermerNotifications(): void {
    this.notifOuvert = false;
  }

  marquerLue(notif: AppNotification, event: Event): void {
    event.stopPropagation();
    if (notif.lu) return;
    this.notificationsService.markRead(notif._id).subscribe({
      next: () => (notif.lu = true),
      error: () => {}
    });
  }

  toutMarquerLu(): void {
    this.notificationsService.markAllRead().subscribe({
      next: () => this.notifications.forEach(n => (n.lu = true)),
      error: () => {}
    });
  }

  // ── Menu utilisateur ──

  toggleUserMenu(): void {
    this.userMenuOuvert = !this.userMenuOuvert;
    this.notifOuvert = false;
  }

  fermerUserMenu(): void {
    this.userMenuOuvert = false;
  }

  goToEspace(): void {
    this.closeMenu();
    this.fermerUserMenu();
    this.router.navigate([this.authService.espaceUrl]);
  }

  goToProfil(): void {
    this.closeMenu();
    this.fermerUserMenu();
    this.router.navigate(['/user/profil']);
  }

  async logout(): Promise<void> {
    this.closeMenu();
    this.fermerUserMenu();
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      icone: 'fa-right-from-bracket',
      labelConfirmer: 'Se déconnecter'
    });
    if (!confirme) return;
    this.authService.logout();
    this.router.navigate(['/']);
  }

  /**
   * Sur la page Boutique, l'icône panier bascule le panneau latéral (drawer) déjà présent
   * sur cette page. Sur les autres pages, elle conserve le comportement existant :
   * navigation vers la page /panier.
   */
  onCartClick(event: Event): void {
    event.preventDefault();
    this.closeMenu();
    if (this.router.url.startsWith('/boutique')) {
      this.cartService.togglePanier();
    } else {
      this.router.navigate(['/panier']);
    }
  }
}
