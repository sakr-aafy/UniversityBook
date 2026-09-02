import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../services/cart.service';
import { AuthService, AuthUser } from '../services/auth.service';
import { BoutiqueFavoritesService } from '../services/boutique-favorites.service';
import { NotificationsService, AppNotification } from '../services/notifications.service';
import { ConfirmDialogService } from '../services/confirm-dialog.service';
import { CategoriesSiteService, CategorieSiteDto } from '../services/categories-site.service';
import { CategoriesCaisseService, CategorieCaisseDto } from '../services/categories-caisse.service';
import { photoUrl } from '../shared/photo-url.util';
import { formatCategorieLabel } from '../shared/format-label.util';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  /** Exposée au template pour l'affichage des catégories/sous-catégories (casse d'origine
   *  imprévisible côté caisse) — voir format-label.util.ts. */
  readonly formatLabel = formatCategorieLabel;

  isMobile: boolean = false;
  menuOpen: boolean = false;
  searchOpen: boolean = false;
  currentLang: string = 'FR';
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

  /** Taxonomie "sur site" (Catégorie/Sous-Catégorie/Sous-Sous-Catégorie), pour le sous-menu
   *  au survol de "Documents" dans le mega-menu Boutique — voir CategoriesSiteService. */
  categoriesSite: CategorieSiteDto[] = [];

  /** Catégorie/Sous-Catégorie du formulaire produit caisse (voir CategoriesCaisseService), pour
   *  le sous-menu au survol de "Fournitures scolaires" dans le mega-menu Boutique. */
  categoriesCaisse: CategorieCaisseDto[] = [];

  /** Rayon actif du mega-menu Boutique (colonne de droite) : piloté au survol du rail.
   *  Valeurs : 'documents' | 'soutenance' | 'fournitures' | 'jeux' | 'payants' | 'gratuits'. */
  megaDomaine: 'documents' | 'soutenance' | 'fournitures' | 'jeux' | 'payants' | 'gratuits' = 'documents';

  /** Catégories exclues de la liste "Fournitures scolaires" du mega-menu uniquement : elles ont
   *  déjà leur propre entrée dédiée dans le menu (liens Soutenance / Jeux) ou relèvent d'un autre
   *  regroupement (Livre → Documents). Comparaison insensible à la casse — les libellés caisse
   *  sont du texte libre ("JEUX", "jeux"…). N'affecte que ce sous-menu, pas les filtres Boutique. */
  private readonly categoriesCaisseExclues = ['soutenance', 'jeux', 'livre'];

  /** Liste "Fournitures scolaires" du mega-menu, privée des catégories gérées ailleurs
   *  (categoriesCaisseExclues). */
  get categoriesCaisseVisibles(): CategorieCaisseDto[] {
    return this.categoriesCaisse.filter(
      c => !this.categoriesCaisseExclues.includes((c.nom || '').trim().toLowerCase())
    );
  }

  /** Équivalent tactile du survol desktop : clés des sections dépliées de l'accordéon Boutique
   *  mobile (ex: 'doc', 'doc:Droit', 'doc:Droit:examen', 'four', 'four:LIVRE') — le survol n'existe
   *  pas au tactile, chaque niveau se déplie/replie au tap plutôt qu'au survol. */
  private mobileExpanded = new Set<string>();

  toggleMobileExpand(key: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.mobileExpanded.has(key)) this.mobileExpanded.delete(key);
    else this.mobileExpanded.add(key);
  }

  isMobileExpanded(key: string): boolean {
    return this.mobileExpanded.has(key);
  }

  private cartSub!: Subscription;
  private authSub!: Subscription;
  private favSub!: Subscription;
  private bumpTimeout: any;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private favoritesService: BoutiqueFavoritesService,
    private notificationsService: NotificationsService,
    private confirmDialogService: ConfirmDialogService,
    private categoriesSiteService: CategoriesSiteService,
    private categoriesCaisseService: CategoriesCaisseService,
    private router: Router
  ) {}

  get notifNonLues(): number {
    return this.notifications.filter(n => !n.lu).length;
  }

  get photoUrl(): string {
    return photoUrl(this.currentUser?.photo);
  }

  ngOnInit(): void {
    this.updateMobile();
    this.categoriesSiteService.list().subscribe({
      next: res => (this.categoriesSite = res.categories),
      error: () => {}
    });
    this.categoriesCaisseService.list().subscribe({
      next: res => (this.categoriesCaisse = res.categories),
      error: () => {}
    });
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
      // Les notifications sont un espace client (backend : requireUser) — un admin connecté
      // (qui parcourt aussi les pages publiques avec ce même header) reçoit systématiquement
      // un 403 sur cet appel, les notifications admin passant par un système séparé.
      if (user && user.role === 'user') {
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

  /** Valeur saisie dans la barre de recherche du header — distincte de
   *  boutique.component.ts#recherche : c'est le paramètre d'URL `q` qui fait le lien entre les
   *  deux (voir lancerRecherche), la Boutique reprend la saisie à l'arrivée sur la page. */
  rechercheHeader: string = '';

  lancerRecherche(): void {
    const q = this.rechercheHeader.trim();
    this.searchOpen = false;
    this.closeMenu();
    this.router.navigate(['/boutique'], q ? { queryParams: { q } } : {});
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.mobileExpanded.clear();
  }

  setLang(l: string): void {
    this.currentLang = l;
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
