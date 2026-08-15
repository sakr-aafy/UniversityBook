import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AdminProduitsService, CatalogueProduit, ProduitForm, VarianteCouleurForm, VarianteFormatForm } from '../../services/admin-produits.service';
import { AdminCategoriesService, Categorie } from '../../services/admin-categories.service';
import { AdminSousCategoriesService, SousCategorie } from '../../services/admin-sous-categories.service';
import { CategoryDialogService } from '../../services/category-dialog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { photoUrl } from '../../shared/photo-url.util';

interface GalerieItem {
  url: string;
  fichier?: File;
}

const PRODUIT_VIDE: ProduitForm = {
  titre: '',
  description: '',
  categorie: '',
  sousCategorie: '',
  type: '',
  prix: 0,
  stock: 0,
  sku: '',
  marque: '',
  codeBarres: '',
  ancienPrix: null,
  badge: '',
  nouveaute: false,
  populaire: false,
  couleurs: [],
  formats: []
};

function lireFichierEnDataUrl(fichier: File): Promise<string> {
  return new Promise(resolve => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.readAsDataURL(fichier);
  });
}

@Component({
  selector: 'app-produits',
  templateUrl: './produits.component.html',
  styleUrls: ['./produits.component.css']
})
export class ProduitsComponent implements OnInit, OnDestroy {
  produits: CatalogueProduit[] = [];
  categories: Categorie[] = [];
  sousCategoriesDisponibles: SousCategorie[] = [];
  chargement: boolean = true;
  erreur: string = '';
  succes: string = '';

  recherche: string = '';
  page: number = 1;
  totalPages: number = 1;

  formulaireOuvert: boolean = false;
  modeEdition: boolean = false;
  idEnCours: string | null = null;
  produitEnCours: ProduitForm = { ...PRODUIT_VIDE };
  enPromotion: boolean = false;

  imageFichier: File | null = null;
  imageApercu: string | null = null;
  imageExistante: string = '';
  galerie: GalerieItem[] = [];

  enregistrement: boolean = false;
  progression: number = 0;

  private categoryDialogSub!: Subscription;

  constructor(
    private adminProduitsService: AdminProduitsService,
    private adminCategoriesService: AdminCategoriesService,
    private adminSousCategoriesService: AdminSousCategoriesService,
    private categoryDialogService: CategoryDialogService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.charger();
    this.chargerCategories();
    this.categoryDialogSub = this.categoryDialogService.etat$.subscribe(etat => {
      if (!etat.ouvert) this.chargerCategories();
    });
  }

  ngOnDestroy(): void {
    this.categoryDialogSub?.unsubscribe();
  }

  ouvrirGestionCategories(): void {
    this.categoryDialogService.ouvrir('fournitures');
  }

  private chargerCategories(): void {
    this.adminCategoriesService.list({ type: 'fournitures' }).subscribe({
      next: res => (this.categories = res.categories),
      error: () => {}
    });
  }

  onCategorieChange(): void {
    const categorie = this.categories.find(c => c.nom === this.produitEnCours.categorie);
    this.sousCategoriesDisponibles = [];
    if (!categorie) return;
    this.adminSousCategoriesService.list({ categorie: categorie._id }).subscribe({
      next: res => (this.sousCategoriesDisponibles = res.sousCategories),
      error: () => {}
    });
  }

  charger(): void {
    this.chargement = true;
    this.adminProduitsService.list({ recherche: this.recherche, page: this.page, limite: 9 }).subscribe({
      next: res => {
        this.produits = res.produits;
        this.totalPages = res.totalPages || 1;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les produits.';
        this.chargement = false;
      }
    });
  }

  rechercher(): void {
    this.page = 1;
    this.charger();
  }

  pagePrecedente(): void {
    if (this.page > 1) { this.page--; this.charger(); }
  }

  pageSuivante(): void {
    if (this.page < this.totalPages) { this.page++; this.charger(); }
  }

  imageUrl(produit: CatalogueProduit): string {
    return photoUrl(produit.image);
  }

  fichierUrl(chemin: string): string {
    return photoUrl(chemin);
  }

  // ══════════════════ Formulaire ══════════════════

  ouvrirAjout(): void {
    this.modeEdition = false;
    this.idEnCours = null;
    this.produitEnCours = { ...PRODUIT_VIDE, couleurs: [], formats: [] };
    this.enPromotion = false;
    this.sousCategoriesDisponibles = [];
    this.reinitialiserFichiers();
    this.formulaireOuvert = true;
  }

  ouvrirEdition(produit: CatalogueProduit): void {
    this.modeEdition = true;
    this.idEnCours = produit._id;
    this.produitEnCours = {
      titre: produit.titre,
      description: produit.description,
      categorie: produit.categorie,
      sousCategorie: produit.sousCategorie || '',
      type: produit.type,
      prix: produit.prix,
      stock: produit.stock,
      sku: produit.sku || '',
      marque: produit.marque || '',
      codeBarres: produit.codeBarres || '',
      ancienPrix: produit.ancienPrix ?? null,
      badge: produit.badge || '',
      nouveaute: !!produit.nouveaute,
      populaire: !!produit.populaire,
      couleurs: (produit.couleurs || []).map(c => ({ ...c })),
      formats: (produit.formats || []).map(f => ({ ...f }))
    };
    this.enPromotion = produit.ancienPrix !== undefined && produit.ancienPrix !== null;
    this.onCategorieChange();
    this.reinitialiserFichiers();
    this.imageExistante = produit.image || '';
    this.galerie = (produit.images || []).map(url => ({ url }));
    this.formulaireOuvert = true;
  }

  annuler(): void {
    this.formulaireOuvert = false;
  }

  private reinitialiserFichiers(): void {
    this.imageFichier = null;
    this.imageApercu = null;
    this.imageExistante = '';
    this.galerie = [];
  }

  onPromotionChange(): void {
    if (!this.enPromotion) this.produitEnCours.ancienPrix = null;
  }

  // ── Image de couverture ──

  async onImageSelectionnee(fichiers: File[]): Promise<void> {
    const fichier = fichiers[0];
    if (!fichier) return;
    this.imageFichier = fichier;
    this.imageApercu = await lireFichierEnDataUrl(fichier);
  }

  supprimerImage(): void {
    this.imageFichier = null;
    this.imageApercu = null;
    this.imageExistante = '';
  }

  // ── Galerie d'images ──

  async onImagesGalerieSelectionnees(fichiers: File[]): Promise<void> {
    for (const fichier of fichiers) {
      const apercu = await lireFichierEnDataUrl(fichier);
      this.galerie.push({ url: apercu, fichier });
    }
  }

  retirerImageGalerie(index: number): void {
    this.galerie.splice(index, 1);
  }

  onErreurUpload(message: string): void {
    this.erreur = message;
  }

  // ── Variantes : couleurs ──

  ajouterCouleur(): void {
    this.produitEnCours.couleurs.push({ nom: '', hex: '#8C2433', stock: 0 } as VarianteCouleurForm);
  }

  retirerCouleur(index: number): void {
    this.produitEnCours.couleurs.splice(index, 1);
  }

  // ── Variantes : formats ──

  ajouterFormat(): void {
    this.produitEnCours.formats.push({ nom: '', prixDelta: 0, stock: 0 } as VarianteFormatForm);
  }

  retirerFormat(index: number): void {
    this.produitEnCours.formats.splice(index, 1);
  }

  // ══════════════════ Enregistrement ══════════════════

  enregistrer(): void {
    if (!this.produitEnCours.titre.trim()) {
      this.erreur = 'Le titre est requis.';
      return;
    }
    this.erreur = '';
    this.enregistrement = true;
    this.progression = 0;

    const imagesExistantes = this.galerie.filter(g => !g.fichier).map(g => g.url);
    const imagesNouvelles = this.galerie.filter(g => g.fichier).map(g => g.fichier as File);

    const requete =
      this.modeEdition && this.idEnCours
        ? this.adminProduitsService.update(this.idEnCours, this.produitEnCours, this.imageFichier, imagesNouvelles, imagesExistantes)
        : this.adminProduitsService.create(this.produitEnCours, this.imageFichier, imagesNouvelles, imagesExistantes);

    requete.subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progression = Math.round((event.loaded / event.total) * 100);
        } else if (event.type === HttpEventType.Response) {
          this.enregistrement = false;
          this.formulaireOuvert = false;
          this.succes = 'Produit enregistré.';
          setTimeout(() => (this.succes = ''), 4000);
          this.charger();
        }
      },
      error: err => {
        this.enregistrement = false;
        this.erreur = err.error?.message || "Erreur lors de l'enregistrement du produit.";
      }
    });
  }

  async supprimer(produit: CatalogueProduit): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Confirmation de suppression',
      message: `Supprimer « ${produit.titre} » du catalogue ? Cette action est irréversible.`,
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.adminProduitsService.remove(produit._id).subscribe({
      next: () => (this.produits = this.produits.filter(p => p._id !== produit._id)),
      error: () => (this.erreur = 'Erreur lors de la suppression du produit.')
    });
  }

  trackById(_index: number, item: CatalogueProduit): string {
    return item._id;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
