import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { AdminCategoriesService, Categorie, CategorieForm, TypeCategorie } from '../../services/admin-categories.service';
import { AdminSousCategoriesService, SousCategorie, SousCategorieForm } from '../../services/admin-sous-categories.service';
import { CategoryDialogService } from '../../services/category-dialog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { photoUrl } from '../photo-url.util';

function categorieVide(type: TypeCategorie): CategorieForm {
  return { nom: '', description: '', icone: '', couleur: '#8C2433', type };
}

@Component({
  selector: 'app-category-dialog',
  templateUrl: './category-dialog.component.html',
  styleUrls: ['./category-dialog.component.css']
})
export class CategoryDialogComponent implements OnInit, OnDestroy {
  ouvert: boolean = false;
  typeActif: TypeCategorie = 'documents';

  categories: Categorie[] = [];
  chargement: boolean = true;
  erreur: string = '';

  formulaireOuvert: boolean = false;
  modeEdition: boolean = false;
  idEnCours: string | null = null;
  categorieEnCours: CategorieForm = categorieVide('documents');
  categorieActifEnCours: boolean = true;
  imageFichier: File | null = null;

  // ── Sous-catégories (gestion imbriquée) ──
  sousCategoriesParCategorie: Record<string, SousCategorie[]> = {};
  sousCategorieOuverte: string | null = null;
  sousFormulaireOuvert: boolean = false;
  sousModeEdition: boolean = false;
  sousIdEnCours: string | null = null;
  sousNomEnCours: string = '';

  private indexGlisse: number | null = null;
  private etatSub!: Subscription;

  constructor(
    private adminCategoriesService: AdminCategoriesService,
    private adminSousCategoriesService: AdminSousCategoriesService,
    private categoryDialogService: CategoryDialogService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.etatSub = this.categoryDialogService.etat$.subscribe(etat => {
      this.ouvert = etat.ouvert;
      if (etat.ouvert) {
        this.typeActif = etat.type;
        this.formulaireOuvert = false;
        this.charger();
      }
    });
  }

  ngOnDestroy(): void {
    this.etatSub?.unsubscribe();
  }

  fermer(): void {
    this.categoryDialogService.fermer();
  }

  charger(): void {
    this.chargement = true;
    // Toutes les sous-catégories sont chargées en une fois (pas une requête par carte
    // dépliée), puis groupées côté client par catégorie parente.
    forkJoin({
      categories: this.adminCategoriesService.list({ type: this.typeActif }),
      sousCategories: this.adminSousCategoriesService.list()
    }).subscribe({
      next: ({ categories, sousCategories }) => {
        this.categories = categories.categories;
        this.sousCategoriesParCategorie = {};
        sousCategories.sousCategories.forEach(sc => {
          if (!this.sousCategoriesParCategorie[sc.categorie]) this.sousCategoriesParCategorie[sc.categorie] = [];
          this.sousCategoriesParCategorie[sc.categorie].push(sc);
        });
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les catégories.';
        this.chargement = false;
      }
    });
  }

  sousCategoriesDe(categorieId: string): SousCategorie[] {
    return this.sousCategoriesParCategorie[categorieId] || [];
  }

  imageUrl(categorie: Categorie): string {
    return photoUrl(categorie.image);
  }

  ouvrirAjout(): void {
    this.modeEdition = false;
    this.idEnCours = null;
    this.categorieEnCours = categorieVide(this.typeActif);
    this.categorieActifEnCours = true;
    this.imageFichier = null;
    this.formulaireOuvert = true;
    this.sousCategorieOuverte = null;
  }

  ouvrirEdition(categorie: Categorie): void {
    this.modeEdition = true;
    this.idEnCours = categorie._id;
    this.categorieEnCours = {
      nom: categorie.nom,
      description: categorie.description,
      icone: categorie.icone,
      couleur: categorie.couleur || '#8C2433',
      type: categorie.type
    };
    this.categorieActifEnCours = categorie.actif;
    this.imageFichier = null;
    this.formulaireOuvert = true;
    this.sousCategorieOuverte = null;
  }

  annulerFormulaire(): void {
    this.formulaireOuvert = false;
  }

  onImageSelectionnee(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageFichier = input.files?.[0] || null;
  }

  enregistrer(): void {
    if (!this.categorieEnCours.nom.trim()) {
      this.erreur = 'Le nom est requis.';
      return;
    }
    this.erreur = '';

    const payload = { ...this.categorieEnCours, actif: this.categorieActifEnCours };
    const requete =
      this.modeEdition && this.idEnCours
        ? this.adminCategoriesService.update(this.idEnCours, payload, this.imageFichier)
        : this.adminCategoriesService.create(this.categorieEnCours, this.imageFichier);

    requete.subscribe({
      next: () => {
        this.formulaireOuvert = false;
        this.charger();
      },
      error: err => (this.erreur = err.error?.message || "Erreur lors de l'enregistrement de la catégorie.")
    });
  }

  basculerActif(categorie: Categorie): void {
    this.adminCategoriesService
      .update(categorie._id, {
        nom: categorie.nom,
        description: categorie.description,
        icone: categorie.icone,
        couleur: categorie.couleur,
        type: categorie.type,
        actif: !categorie.actif
      })
      .subscribe({
        next: res => (categorie.actif = res.categorie.actif),
        error: () => (this.erreur = 'Erreur lors de la mise à jour du statut.')
      });
  }

  async supprimer(categorie: Categorie): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Confirmation de suppression',
      message: `Supprimer la catégorie « ${categorie.nom} » ? Les produits/documents existants gardent leur catégorie en texte mais perdront l'icône/couleur associée.`,
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.adminCategoriesService.remove(categorie._id).subscribe({
      next: () => (this.categories = this.categories.filter(c => c._id !== categorie._id)),
      error: () => (this.erreur = 'Erreur lors de la suppression de la catégorie.')
    });
  }

  // ══════════════════ Sous-catégories (imbriquées) ══════════════════

  toggleSousCategories(categorieId: string): void {
    this.sousCategorieOuverte = this.sousCategorieOuverte === categorieId ? null : categorieId;
    this.sousFormulaireOuvert = false;
    this.formulaireOuvert = false;
  }

  ouvrirAjoutSous(categorieId: string): void {
    this.sousModeEdition = false;
    this.sousIdEnCours = null;
    this.sousNomEnCours = '';
    this.sousCategorieOuverte = categorieId;
    this.sousFormulaireOuvert = true;
  }

  ouvrirEditionSous(sousCategorie: SousCategorie): void {
    this.sousModeEdition = true;
    this.sousIdEnCours = sousCategorie._id;
    this.sousNomEnCours = sousCategorie.nom;
    this.sousFormulaireOuvert = true;
  }

  annulerSous(): void {
    this.sousFormulaireOuvert = false;
  }

  enregistrerSous(categorieId: string): void {
    if (!this.sousNomEnCours.trim()) return;
    this.erreur = '';

    const payload: SousCategorieForm = { nom: this.sousNomEnCours.trim(), categorie: categorieId };
    const requete =
      this.sousModeEdition && this.sousIdEnCours
        ? this.adminSousCategoriesService.update(this.sousIdEnCours, payload)
        : this.adminSousCategoriesService.create(payload);

    requete.subscribe({
      next: () => {
        this.sousFormulaireOuvert = false;
        this.charger();
      },
      error: err => (this.erreur = err.error?.message || "Erreur lors de l'enregistrement de la sous-catégorie.")
    });
  }

  basculerActifSous(sousCategorie: SousCategorie): void {
    this.adminSousCategoriesService
      .update(sousCategorie._id, { nom: sousCategorie.nom, categorie: sousCategorie.categorie, actif: !sousCategorie.actif })
      .subscribe({
        next: res => (sousCategorie.actif = res.sousCategorie.actif),
        error: () => (this.erreur = 'Erreur lors de la mise à jour du statut.')
      });
  }

  async supprimerSous(sousCategorie: SousCategorie): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Confirmation de suppression',
      message: `Supprimer la sous-catégorie « ${sousCategorie.nom} » ?`,
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.adminSousCategoriesService.remove(sousCategorie._id).subscribe({
      next: () => this.charger(),
      error: () => (this.erreur = 'Erreur lors de la suppression de la sous-catégorie.')
    });
  }

  trackByIdSous(_index: number, item: SousCategorie): string {
    return item._id;
  }

  onDragStart(index: number): void {
    this.indexGlisse = index;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(index: number): void {
    if (this.indexGlisse === null || this.indexGlisse === index) return;

    const categories = [...this.categories];
    const [deplacee] = categories.splice(this.indexGlisse, 1);
    categories.splice(index, 0, deplacee);
    this.categories = categories;
    this.indexGlisse = null;

    this.adminCategoriesService.reorder(categories.map(c => c._id)).subscribe({
      error: () => {
        this.erreur = "Erreur lors de l'enregistrement de l'ordre.";
        this.charger();
      }
    });
  }

  trackById(_index: number, item: Categorie): string {
    return item._id;
  }
}
