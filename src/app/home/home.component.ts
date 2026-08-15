import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CompareService } from '../services/compare.service';

interface HeroGalleryImage {
  /** Emplacement attendu pour une future photo grand format. */
  image: string;
  /** Dégradé de repli affiché tant que le fichier ci-dessus n'existe pas encore dans assets/images. */
  gradient: string;
  label: string;
}

interface HeroStat {
  emoji: string;
  valeur: string;
  label: string;
}

interface CarouselProduit {
  id: number;
  titre: string;
  prix: number;
  ancienPrix?: number;
  icone: string;
  iconeBg: string;
  badge?: string;
}

interface CategorieSection {
  key: string;
  titre: string;
  description: string;
  icone: string;
  image: string;
  gradient: string;
  /** Emplacement attendu pour une future animation Lottie (assets/lottie/*.json) — repli en icône animée tant qu'absente. */
  lottiePath: string;
  ctaLabel: string;
  lien: string;
  carouselTitre: string;
  produits: CarouselProduit[];
}

interface Avantage {
  icone: string;
  titre: string;
  description: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  constructor(
    private cartService: CartService,
    private compareService: CompareService,
    private router: Router
  ) {}

  promoImage = 'assets/images/documents.svg';

  // ── Hero : galerie grand format (colonne droite) ──
  heroImgActif = 0;
  private heroGalleryTimer?: ReturnType<typeof setInterval>;
  private heroTouchStartX = 0;

  heroGalleryImages: HeroGalleryImage[] = [
    { image: 'assets/images/hero.jpg', gradient: 'linear-gradient(150deg, #8B5CF6 0%, #6D28D9 100%)', label: 'Fournitures scolaires' },
    { image: 'assets/images/img.jpg',      gradient: 'linear-gradient(150deg, #F59E0B 0%, #B45309 100%)', label: 'Cahiers & papeterie' },
    { image: 'assets/images/img1.jpg',       gradient: 'linear-gradient(150deg, #0EA5E9 0%, #0369A1 100%)', label: 'Stylos' },
    { image: 'assets/images/img2.jpg',    gradient: 'linear-gradient(150deg, #EC4899 0%, #9D174D 100%)', label: 'Cartables' },
    { image: 'assets/images/img3.jpg',gradient: 'linear-gradient(150deg, #64748B 0%, #334155 100%)', label: 'Calculatrices' },
    { image: 'assets/images/img4.jpg',       gradient: 'linear-gradient(150deg, #1B2430 0%, #0D1218 100%)', label: 'Livres' },
    { image: 'assets/images/hero4.jpg',    gradient: 'linear-gradient(150deg, #8C2433 0%, #6E1726 100%)', label: 'Documents numériques' },
    { image: 'assets/images/hero5.jpg',          gradient: 'linear-gradient(150deg, #0F3B4C 0%, #164E63 100%)', label: 'PDF & e-books' },
    { image: 'assets/images/hero6.jpg',    gradient: 'linear-gradient(150deg, #14532D 0%, #166534 100%)', label: 'Templates' },
  ];

  heroStats: HeroStat[] = [
    { emoji: '📚', valeur: '500+',  label: 'Produits' },
    { emoji: '📄', valeur: '300+',  label: 'Documents' },
    { emoji: '👨‍🎓', valeur: '2500+', label: 'Clients' },
    { emoji: '⭐', valeur: '98%',   label: 'Satisfaction' },
  ];

  get heroImgSecondaire1(): number {
    return (this.heroImgActif + 1) % this.heroGalleryImages.length;
  }

  get heroImgSecondaire2(): number {
    return (this.heroImgActif + 2) % this.heroGalleryImages.length;
  }

  categorySections: CategorieSection[] = [
    {
      key: 'fournitures',
      titre: 'Fournitures scolaires',
      description: 'Tout le matériel qu\'il vous faut pour vos études : cartables, papeterie et outils de précision.',
      icone: 'fa-backpack',
      image: 'assets/images/scolair.jpg',
      gradient: 'linear-gradient(160deg, #8B5CF6 0%, #7C3AED 45%, #5B21B6 100%)',
      lottiePath: 'assets/images/Back.json',
      ctaLabel: 'Voir la boutique',
      lien: '/boutique',
      carouselTitre: 'Nos meilleures fournitures',
      produits: [
        { id: 101, titre: 'Cartable premium multi-poches', prix: 89.900, ancienPrix: 109.900, icone: 'fa-backpack', iconeBg: '#FDF2F3', badge: '-18%' },
        { id: 102, titre: 'Trousse complète 40 pièces', prix: 24.500, icone: 'fa-pen-ruler', iconeBg: '#EFF6FF' },
        { id: 103, titre: 'Calculatrice scientifique', prix: 45.000, icone: 'fa-calculator', iconeBg: '#EDF7F0', badge: 'Nouveau' },
        { id: 104, titre: 'Kit de géométrie précision', prix: 18.900, icone: 'fa-drafting-compass', iconeBg: '#FFF7ED' },
        { id: 105, titre: 'Lot de classeurs A4', prix: 21.000, icone: 'fa-folder-open', iconeBg: '#F5F3FF' },
        { id: 106, titre: 'Ordinateur portable étudiant', prix: 1290.000, icone: 'fa-laptop', iconeBg: '#EFF6FF', badge: 'Best-seller' }
      ]
    },
    {
      key: 'documents',
      titre: 'Documents universitaires',
      description: 'Cours, polycopiés, examens corrigés et annales numériques prêts à télécharger.',
      icone: 'fa-book-open',
      image: 'assets/images/d.jpg',
      gradient: 'linear-gradient(160deg, #232B36 0%, #1B2430 50%, #0D1218 100%)',
      lottiePath: 'assets/images/Document.json',
      ctaLabel: 'Voir les documents',
      lien: '/boutique',
      carouselTitre: 'Documents les plus populaires',
      produits: [
        { id: 201, titre: 'Code du travail – Édition 2026', prix: 28.500, icone: 'fa-scale-balanced', iconeBg: '#FDF2F3', badge: 'Nouveau' },
        { id: 202, titre: 'Examens corrigés Droit Sfax', prix: 14.000, icone: 'fa-file-lines', iconeBg: '#EFF6FF', badge: 'Best-seller' },
        { id: 203, titre: 'Manuel de sémiologie médicale', prix: 32.000, icone: 'fa-stethoscope', iconeBg: '#EDF7F0' },
        { id: 204, titre: 'Comptabilité générale IHEC S2', prix: 22.000, icone: 'fa-chart-line', iconeBg: '#FFF7ED' },
        { id: 205, titre: 'Micro-économie FSEG Tunis L1', prix: 0, icone: 'fa-briefcase', iconeBg: '#F5F3FF', badge: 'Gratuit' },
        { id: 206, titre: 'Électronique numérique ISET', prix: 19.000, icone: 'fa-gears', iconeBg: '#FDF2F3' }
      ]
    }
  ];

  pourquoiNous: Avantage[] = [
    { icone: 'fa-book-open-reader', titre: 'Sélection rigoureuse', description: 'Documents et fournitures choisis pour accompagner votre réussite universitaire.' },
    { icone: 'fa-bolt', titre: 'Commande rapide', description: 'Boutique fluide, panier intelligent, paiement en quelques clics.' },
    { icone: 'fa-shield-halved', titre: 'Achat en confiance', description: 'Paiement sécurisé et suivi de commande transparent à chaque étape.' },
    { icone: 'fa-headset', titre: 'Support réactif', description: 'Une équipe disponible pour vous accompagner avant et après l\'achat.' }
  ];

  avantages: Avantage[] = [
    { icone: 'fa-shield-halved', titre: 'Paiement sécurisé', description: 'Vos transactions sont 100 % sécurisées.' },
    { icone: 'fa-truck-fast', titre: 'Livraison rapide', description: 'Livraison gratuite à partir de 100 DT.' },
    { icone: 'fa-headset', titre: 'Support 24/7', description: 'Notre équipe est disponible à tout moment.' },
    { icone: 'fa-award', titre: 'Garantie qualité', description: 'Produits authentiques et de qualité.' },
    { icone: 'fa-arrow-rotate-left', titre: 'Retours faciles', description: 'Retour gratuit sous 14 jours.' },
    { icone: 'fa-wallet', titre: 'Paiement à la livraison', description: 'Paiement lors de la réception.' }
  ];

  ngOnInit(): void {
    this.demarrerGalerieAutoplay();
  }

  ngOnDestroy(): void {
    if (this.heroGalleryTimer) clearInterval(this.heroGalleryTimer);
  }

  private demarrerGalerieAutoplay(): void {
    this.heroGalleryTimer = setInterval(() => this.galerieSuivante(), 4500);
  }

  pauseGalerieAutoplay(): void {
    if (this.heroGalleryTimer) clearInterval(this.heroGalleryTimer);
  }

  reprendreGalerieAutoplay(): void {
    this.pauseGalerieAutoplay();
    this.demarrerGalerieAutoplay();
  }

  allerAGalerieImage(i: number): void {
    this.heroImgActif = i;
  }

  galerieSuivante(): void {
    this.heroImgActif = (this.heroImgActif + 1) % this.heroGalleryImages.length;
  }

  galeriePrecedente(): void {
    this.heroImgActif = (this.heroImgActif - 1 + this.heroGalleryImages.length) % this.heroGalleryImages.length;
  }

  onHeroTouchStart(event: TouchEvent): void {
    this.heroTouchStartX = event.changedTouches[0].clientX;
  }

  onHeroTouchEnd(event: TouchEvent): void {
    const deltaX = event.changedTouches[0].clientX - this.heroTouchStartX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) this.galerieSuivante();
    else this.galeriePrecedente();
  }

  faireDefiler(track: HTMLElement, direction: number): void {
    track.scrollBy({ left: direction * 300, behavior: 'smooth' });
  }

  formatPrix(v: number): string {
    if (v === 0) return 'Gratuit';
    return v.toFixed(3).replace('.', ',') + ' د.ت';
  }

  ajouterPanier(p: CarouselProduit, categorie: string): void {
    this.cartService.ajouter({
      id: p.id,
      titre: p.titre,
      categorie,
      prix: p.prix,
      icone: p.icone
    });
  }

  ouvrirCategorie(lien: string): void {
    this.router.navigateByUrl(lien);
  }

  estDansComparateur(id: number): boolean {
    return this.compareService.estDansComparateur(id);
  }

  toggleComparaison(p: CarouselProduit, categorie: string, event: Event): void {
    event.stopPropagation();
    this.compareService.toggle({
      id: p.id,
      titre: p.titre,
      categorie,
      prix: p.prix,
      icone: p.icone
    });
  }
}
