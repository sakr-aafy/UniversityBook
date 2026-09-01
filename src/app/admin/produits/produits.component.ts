import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AdminProduitsService, CatalogueProduit, ProduitForm, VarianteCouleurForm, VarianteFormatForm, PackItemForm } from '../../services/admin-produits.service';
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
  sousSousCategorie: '',
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
  disponible: true,
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

  // ── Créer / modifier un pack (lot de plusieurs produits du site) ───────────
  dialogPackOuvert: boolean = false;
  /** null = création ; sinon _id du pack (Produit badge 'Pack') en cours de modification. */
  packEditId: string | null = null;
  packNom: string = '';
  packCategorie: string = '';
  packSousCategorie: string = '';
  packSousSousCategorie: string = '';
  packPrix: number | null = null;
  /** Points de fidélité rapportés par le pack. */
  packPointFidelite: number | null = null;
  packRecherche: string = '';
  packSelection: { produit: CatalogueProduit; quantite: number }[] = [];
  packImageFichier: File | null = null;
  packImageApercu: string | null = null;
  creationPackEnCours: boolean = false;
  erreurPack: string = '';
  /** Catalogue COMPLET (toutes pages) chargé à l'ouverture du formulaire pack — la recherche du
   *  picker porte sur tout le catalogue, pas seulement la page courante `produits`. */
  packCatalogue: CatalogueProduit[] = [];
  packCatalogueChargement: boolean = false;

  private categoryDialogSub!: Subscription;

  /** _id d'un produit à ouvrir en édition dès l'arrivée (navigation « Modifier » depuis la
   *  Boutique, voir boutique.component.ts#modifierProduitAdmin) — résolu après le 1er `charger()`. */
  private editerAlArrivee: string | null = null;

  constructor(
    private adminProduitsService: AdminProduitsService,
    private adminCategoriesService: AdminCategoriesService,
    private adminSousCategoriesService: AdminSousCategoriesService,
    private categoryDialogService: CategoryDialogService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    // Arrivée depuis le bouton « Modifier » d'une carte Boutique (état de navigation) : on
    // pré-filtre la liste sur le titre et on ouvrira la fiche dès qu'elle est chargée.
    const nav = history.state as { editerId?: string; editerRecherche?: string } | null;
    if (nav?.editerId) {
      this.editerAlArrivee = nav.editerId;
      if (nav.editerRecherche) this.recherche = nav.editerRecherche;
    }
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
        if (this.editerAlArrivee) {
          const cible = this.produits.find(p => p._id === this.editerAlArrivee);
          this.editerAlArrivee = null;
          if (cible) this.ouvrirEdition(cible);
        }
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
      sousSousCategorie: produit.sousSousCategorie || '',
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
      disponible: produit.disponible !== false,
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

  // ══════════════════ Créer un pack ══════════════════
  // Un "pack" est un produit du catalogue à part entière (POST /api/admin/produits) dont le prix
  // est le prix du lot et la description liste son contenu — pas de nouveau modèle backend.

  ouvrirCreationPack(): void {
    this.packEditId = null;
    this.packNom = '';
    this.packCategorie = '';
    this.packSousCategorie = '';
    this.packSousSousCategorie = '';
    this.packPrix = null;
    this.packPointFidelite = null;
    this.packRecherche = '';
    this.packSelection = [];
    this.packImageFichier = null;
    this.packImageApercu = null;
    this.erreurPack = '';
    this.dialogPackOuvert = true;
    this.chargerPackCatalogue();
  }

  /** Ouvre le formulaire pack en modification : préremplit les infos et recoche exactement la
   *  composition enregistrée (Produit.packItems). Seuls les produits du pack sont pré-sélectionnés
   *  — l'admin peut les retirer / changer les quantités / en ajouter d'autres. */
  ouvrirModificationPack(p: CatalogueProduit): void {
    this.packEditId = p._id;
    this.packNom = p.titre || '';
    this.packCategorie = p.categorie || '';
    this.packSousCategorie = p.sousCategorie || '';
    this.packSousSousCategorie = p.sousSousCategorie || '';
    this.packPrix = p.prix ?? null;
    this.packPointFidelite = p.pointFidelite ?? null;
    this.packRecherche = '';
    this.packSelection = [];
    this.packImageFichier = null;
    this.packImageApercu = p.image ? photoUrl(p.image) : null;
    this.erreurPack = '';
    this.dialogPackOuvert = true;
    this.chargerPackCatalogue(p.packItems || []);
  }

  /** Charge tout le catalogue (sans pagination) pour le picker du formulaire pack. `composition`
   *  (édition d'un pack) : reconstruit `packSelection` une fois le catalogue disponible. */
  private chargerPackCatalogue(composition: PackItemForm[] = []): void {
    this.packCatalogueChargement = true;
    this.adminProduitsService.list({ page: 1, limite: 100000 }).subscribe({
      next: res => {
        // On ne propose pas un pack existant comme composant d'un autre pack.
        this.packCatalogue = res.produits.filter(p => p.badge !== 'Pack' && p._id !== this.packEditId);
        this.packCatalogueChargement = false;
        if (composition.length) {
          this.packSelection = composition.map(it => {
            const trouve = this.packCatalogue.find(p => p._id === it.produit);
            const produit = trouve ?? ({
              _id: it.produit, titre: it.titre, prix: it.prix,
              description: '', categorie: '', sousCategorie: '', sousSousCategorie: '', type: '',
              stock: 0, image: '', images: [], actif: true, sku: '', marque: '', codeBarres: '',
              badge: '', nouveaute: false, populaire: false, disponible: true,
              couleurs: [], formats: [], createdAt: ''
            } as CatalogueProduit);
            return { produit, quantite: Math.max(1, it.quantite || 1) };
          });
        }
      },
      error: () => {
        this.packCatalogue = [];
        this.packCatalogueChargement = false;
        this.erreurPack = 'Impossible de charger la liste des produits.';
      }
    });
  }

  fermerCreationPack(): void {
    this.dialogPackOuvert = false;
    this.packEditId = null;
  }

  get packProduitsFiltres(): CatalogueProduit[] {
    const q = this.packRecherche.trim().toLowerCase();
    if (!q) return this.packCatalogue;
    return this.packCatalogue.filter(p =>
      p.titre.toLowerCase().includes(q) ||
      (p.categorie || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.marque || '').toLowerCase().includes(q)
    );
  }

  private valeursDistinctes(valeurs: (string | undefined)[]): string[] {
    return [...new Set(valeurs.map(v => (v || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  /** Catégories / sous-catégories / sous-sous-catégories réellement présentes dans le catalogue —
   *  mêmes libellés et hiérarchie que le Header / la Boutique (dérivés des produits). Chaque
   *  niveau est filtré par le choix du niveau supérieur. */
  get packCategoriesDisponibles(): string[] {
    return this.valeursDistinctes(this.packCatalogue.map(p => p.categorie));
  }

  get packSousCategoriesDisponibles(): string[] {
    if (!this.packCategorie) return [];
    return this.valeursDistinctes(
      this.packCatalogue.filter(p => p.categorie === this.packCategorie).map(p => p.sousCategorie)
    );
  }

  get packSousSousCategoriesDisponibles(): string[] {
    if (!this.packSousCategorie) return [];
    return this.valeursDistinctes(
      this.packCatalogue
        .filter(p => p.categorie === this.packCategorie && p.sousCategorie === this.packSousCategorie)
        .map(p => p.sousSousCategorie)
    );
  }

  onPackCategorieChange(): void {
    this.packSousCategorie = '';
    this.packSousSousCategorie = '';
  }

  onPackSousCategorieChange(): void {
    this.packSousSousCategorie = '';
  }

  estDansPack(p: CatalogueProduit): boolean {
    return this.packSelection.some(s => s.produit._id === p._id);
  }

  basculerProduitPack(p: CatalogueProduit): void {
    const i = this.packSelection.findIndex(s => s.produit._id === p._id);
    if (i >= 0) this.packSelection.splice(i, 1);
    else this.packSelection.push({ produit: p, quantite: 1 });
  }

  changerQtePack(s: { produit: CatalogueProduit; quantite: number }, delta: number): void {
    s.quantite = Math.max(1, s.quantite + delta);
  }

  retirerDuPack(s: { produit: CatalogueProduit; quantite: number }): void {
    this.packSelection = this.packSelection.filter(x => x !== s);
  }

  /** Somme des prix des composants (× quantités) — prix "plein" du pack avant remise éventuelle. */
  get packTotalComposants(): number {
    return Math.round(this.packSelection.reduce((acc, s) => acc + (s.produit.prix || 0) * s.quantite, 0) * 1000) / 1000;
  }

  get packEconomie(): number {
    const px = this.packPrix != null && this.packPrix > 0 ? this.packPrix : this.packTotalComposants;
    return Math.max(0, Math.round((this.packTotalComposants - px) * 1000) / 1000);
  }

  get packDescriptionAuto(): string {
    if (!this.packSelection.length) return '';
    return 'Pack : ' + this.packSelection.map(s => `${s.quantite} × ${s.produit.titre}`).join(', ');
  }

  async onPackImageSelectionnee(fichiers: File[]): Promise<void> {
    const fichier = fichiers[0];
    if (!fichier) return;
    this.packImageFichier = fichier;
    this.packImageApercu = await lireFichierEnDataUrl(fichier);
  }

  supprimerPackImage(): void {
    this.packImageFichier = null;
    this.packImageApercu = null;
  }

  creerPack(): void {
    this.erreurPack = '';
    if (!this.packNom.trim()) {
      this.erreurPack = 'Le nom du pack est requis.';
      return;
    }
    if (this.packSelection.length < 2) {
      this.erreurPack = 'Sélectionnez au moins 2 produits pour composer un pack.';
      return;
    }

    const prixPack = this.packPrix != null && this.packPrix > 0 ? this.packPrix : this.packTotalComposants;
    const packItems: PackItemForm[] = this.packSelection.map(s => ({
      produit: s.produit._id,
      titre: s.produit.titre,
      quantite: s.quantite,
      prix: s.produit.prix || 0
    }));
    const form: ProduitForm = {
      ...PRODUIT_VIDE,
      titre: this.packNom.trim(),
      description: this.packDescriptionAuto,
      categorie: this.packCategorie || '',
      sousCategorie: this.packSousCategorie || '',
      sousSousCategorie: this.packSousSousCategorie || '',
      type: 'fournitures',
      prix: prixPack,
      // Prix "plein" barré + badge "Pack" quand le lot est vendu moins cher que la somme.
      ancienPrix: prixPack < this.packTotalComposants ? this.packTotalComposants : null,
      badge: 'Pack',
      couleurs: [],
      formats: [],
      pointFidelite: this.packPointFidelite != null ? Math.max(0, Number(this.packPointFidelite) || 0) : 0,
      packItems
    };

    this.creationPackEnCours = true;
    const requete = this.packEditId
      ? this.adminProduitsService.update(this.packEditId, form, this.packImageFichier, [], undefined)
      : this.adminProduitsService.create(form, this.packImageFichier, [], []);
    const enEdition = !!this.packEditId;
    requete.subscribe({
      next: event => {
        if (event.type === HttpEventType.Response) {
          this.creationPackEnCours = false;
          this.dialogPackOuvert = false;
          this.packEditId = null;
          this.succes = enEdition ? `Pack « ${form.titre} » modifié.` : `Pack « ${form.titre} » créé.`;
          setTimeout(() => (this.succes = ''), 4000);
          this.charger();
        }
      },
      error: err => {
        this.creationPackEnCours = false;
        this.erreurPack = err.error?.message || (enEdition ? 'Erreur lors de la modification du pack.' : 'Erreur lors de la création du pack.');
      }
    });
  }

  trackById(_index: number, item: CatalogueProduit): string {
    return item._id;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
