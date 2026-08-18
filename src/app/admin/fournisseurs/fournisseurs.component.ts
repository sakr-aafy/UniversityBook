import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
import { AdminDocumentsService, CatalogueDocument, DocumentCatalogueForm } from '../../services/admin-documents.service';
import { AdminCategoriesService, Categorie } from '../../services/admin-categories.service';
import { AdminSousCategoriesService, SousCategorie } from '../../services/admin-sous-categories.service';
import { CategoryDialogService } from '../../services/category-dialog.service';
import { photoUrl } from '../../shared/photo-url.util';

@Component({
  selector: 'app-fournisseurs',
  templateUrl: './fournisseurs.component.html',
  styleUrls: ['./fournisseurs.component.scss']
})
export class FournisseursComponent implements OnInit, OnDestroy {

  constructor(
    private documentsApi: AdminDocumentsService,
    private categoriesApi: AdminCategoriesService,
    private sousCategoriesApi: AdminSousCategoriesService,
    private categoryDialogService: CategoryDialogService
  ) {}

  // ── Data ──────────────────────────────────────────────────────────────────
  documents: CatalogueDocument[] = [];
  categoriesData: Categorie[] = [];

  get categories(): string[] {
    return this.categoriesData.map(c => c.nom);
  }

  private categoryDialogSub?: Subscription;

  ngOnInit(): void {
    this.chargerCategories();
    this.chargerDocuments();
    // Le dialogue partagé "Gérer les catégories" (rendu une fois dans app.component.html,
    // voir shared/category-dialog) prévient de sa fermeture via cet état plutôt que de
    // renvoyer les catégories directement — on recharge les nôtres à ce moment-là.
    this.categoryDialogSub = this.categoryDialogService.etat$.subscribe(etat => {
      if (!etat.ouvert) this.chargerCategories();
    });
  }

  ngOnDestroy(): void {
    this.categoryDialogSub?.unsubscribe();
  }

  imageUrl(chemin?: string): string {
    return photoUrl(chemin);
  }

  private chargerDocuments(): void {
    this.documentsApi.list({ limite: 1000 }).subscribe({
      next: ({ documents }) => this.documents = documents,
      error: () => { /* best-effort */ }
    });
  }

  private chargerCategories(): void {
    this.categoriesApi.list({ type: 'documents' }).subscribe({
      next: ({ categories }) => this.categoriesData = categories,
      error: () => { /* best-effort */ }
    });
  }

  ouvrirGestionCategories(): void {
    this.categoryDialogService.ouvrir('documents');
  }

  /** Sous-catégories actives de la catégorie sélectionnée dans le formulaire (interrogées par
   *  l'_id de la catégorie — voir AdminSousCategoriesService — puis stockées par nom sur le
   *  document, comme categorie). */
  sousCategoriesDisponibles: SousCategorie[] = [];

  onCategorieChange(): void {
    const categorie = this.categoriesData.find(c => c.nom === this.form.categorie);
    this.sousCategoriesDisponibles = [];
    this.form.sousCategorie = '';
    if (!categorie) return;
    this.sousCategoriesApi.list({ categorie: categorie._id }).subscribe({
      next: res => this.sousCategoriesDisponibles = res.sousCategories,
      error: () => { /* best-effort */ }
    });
  }

  // ── Filters / pagination state ───────────────────────────────────────────
  searchQuery     = '';
  categorieFiltre = '';
  typeFiltre      = ''; // '' | 'payant' | 'gratuit'

  currentPage     = 1;
  pageSize        = 10;
  pageSizeOptions = [5, 10, 20, 50];

  sortCol = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';

  selectedIds = new Set<string>();

  // ── Modal state ───────────────────────────────────────────────────────────
  showModalForm    = false;
  showModalDetail  = false;
  showModalDelete  = false;
  isEditMode = false;
  enregistrementEnCours = false;

  docDetail: CatalogueDocument | null = null;
  docDelete: CatalogueDocument | null = null;

  // ── Form ──────────────────────────────────────────────────────────────────
  form = {
    titre: '', categorie: '', sousCategorie: '', description: '', type: '',
    prix: 0, gratuit: false, actif: true,
  };

  imageFile: File | null = null;
  imagePreview = '';
  fichierFile: File | null = null;
  fichierNom = '';
  imagesExistantes: string[] = [];
  imagesFiles: File[] = [];
  imagesApercus: string[] = [];

  // ── Stat getters ──────────────────────────────────────────────────────────
  get totalDocs(): number    { return this.documents.length; }
  get docsPayants(): number  { return this.documents.filter(d => !d.gratuit).length; }
  get docsGratuits(): number { return this.documents.filter(d => d.gratuit).length; }

  // ── Documents tab getters ─────────────────────────────────────────────────
  get documentsFiltres(): CatalogueDocument[] {
    let r = [...this.documents];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      r = r.filter(d => d.titre.toLowerCase().includes(q) || d.categorie.toLowerCase().includes(q));
    }
    if (this.categorieFiltre) r = r.filter(d => d.categorie === this.categorieFiltre);
    if (this.typeFiltre === 'payant')  r = r.filter(d => !d.gratuit);
    if (this.typeFiltre === 'gratuit') r = r.filter(d => d.gratuit);

    r.sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortCol) {
        case 'titre':     va = a.titre;     vb = b.titre;     break;
        case 'categorie': va = a.categorie; vb = b.categorie; break;
        case 'prix':      va = a.prix;      vb = b.prix;      break;
        default:          va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime();
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.documentsFiltres.length / this.pageSize)); }
  get documentsPagines(): CatalogueDocument[] { const s = (this.currentPage - 1) * this.pageSize; return this.documentsFiltres.slice(s, s + this.pageSize); }

  get paginationInfo(): string {
    const total = this.documentsFiltres.length;
    if (!total) return 'Aucun document trouvé';
    const s = (this.currentPage - 1) * this.pageSize + 1, e = Math.min(this.currentPage * this.pageSize, total);
    return `${s}–${e} sur ${total} documents`;
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.categorieFiltre || this.typeFiltre);
  }

  // ── Page numbers helper ───────────────────────────────────────────────────
  buildPages(cur: number, total: number): (number | -1)[] {
    const p: (number | -1)[] = [];
    if (total <= 7) { for (let i = 1; i <= total; i++) p.push(i); return p; }
    p.push(1);
    if (cur > 3) p.push(-1);
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) p.push(i);
    if (cur < total - 2) p.push(-1);
    p.push(total);
    return p;
  }

  get pageNumbers(): (number | -1)[] { return this.buildPages(this.currentPage, this.totalPages); }

  // ── Selection ─────────────────────────────────────────────────────────────
  get allSelected(): boolean { return this.documentsPagines.length > 0 && this.documentsPagines.every(d => this.selectedIds.has(d._id)); }
  get someSelected(): boolean { return this.selectedIds.size > 0; }
  toggleAll(): void { if (this.allSelected) this.documentsPagines.forEach(d => this.selectedIds.delete(d._id)); else this.documentsPagines.forEach(d => this.selectedIds.add(d._id)); }
  toggleSelect(id: string): void { if (this.selectedIds.has(id)) this.selectedIds.delete(id); else this.selectedIds.add(id); }

  // ── Sort ──────────────────────────────────────────────────────────────────
  sort(col: string): void {
    if (this.sortCol === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortCol = col; this.sortDir = 'asc'; }
    this.currentPage = 1;
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  resetFilters(): void {
    this.searchQuery = ''; this.categorieFiltre = ''; this.typeFiltre = '';
    this.currentPage = 1;
  }

  private remplacerDocumentLocal(doc: CatalogueDocument): void {
    const idx = this.documents.findIndex(d => d._id === doc._id);
    if (idx >= 0) this.documents[idx] = doc;
  }

  // ── Documents CRUD ────────────────────────────────────────────────────────
  ouvrirAjout(): void {
    this.isEditMode = false; this.docDetail = null;
    this.form = { titre: '', categorie: this.categories[0] ?? '', sousCategorie: '', description: '', type: '', prix: 0, gratuit: false, actif: true };
    this.sousCategoriesDisponibles = [];
    if (this.form.categorie) this.onCategorieChange();
    this.imageFile = null; this.imagePreview = '';
    this.fichierFile = null; this.fichierNom = '';
    this.imagesExistantes = []; this.imagesFiles = []; this.imagesApercus = [];
    this.showModalForm = true;
  }

  ouvrirModification(d: CatalogueDocument): void {
    this.isEditMode = true; this.docDetail = d;
    this.form = { titre: d.titre, categorie: d.categorie, sousCategorie: d.sousCategorie, description: d.description, type: d.type, prix: d.prix, gratuit: d.gratuit, actif: d.actif };
    const categorie = this.categoriesData.find(c => c.nom === d.categorie);
    this.sousCategoriesDisponibles = [];
    if (categorie) {
      this.sousCategoriesApi.list({ categorie: categorie._id }).subscribe({
        next: res => this.sousCategoriesDisponibles = res.sousCategories,
        error: () => { /* best-effort */ }
      });
    }
    this.imageFile = null; this.imagePreview = d.image || '';
    this.fichierFile = null; this.fichierNom = d.fichier ? (d.fichier.split('/').pop() || '') : '';
    this.imagesExistantes = [...(d.images || [])]; this.imagesFiles = []; this.imagesApercus = [];
    this.showModalForm = true;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.imageFile = file;
    const lecteur = new FileReader();
    lecteur.onload = () => this.imagePreview = lecteur.result as string;
    lecteur.readAsDataURL(file);
  }

  retirerImage(): void {
    this.imageFile = null;
    this.imagePreview = '';
  }

  onFichierSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fichierFile = file;
    this.fichierNom = file.name;
  }

  detacherFichier(): void {
    this.fichierFile = null;
    this.fichierNom = '';
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichiers = Array.from(input.files || []);
    fichiers.forEach(f => {
      this.imagesFiles.push(f);
      const lecteur = new FileReader();
      lecteur.onload = () => this.imagesApercus.push(lecteur.result as string);
      lecteur.readAsDataURL(f);
    });
    input.value = '';
  }

  retirerImageExistante(url: string): void {
    this.imagesExistantes = this.imagesExistantes.filter(u => u !== url);
  }

  retirerNouvelleImage(index: number): void {
    this.imagesFiles.splice(index, 1);
    this.imagesApercus.splice(index, 1);
  }

  sauvegarder(): void {
    if (!this.form.titre.trim() || this.enregistrementEnCours) return;
    this.enregistrementEnCours = true;

    const payload: DocumentCatalogueForm = {
      titre: this.form.titre.trim(),
      description: this.form.description,
      categorie: this.form.categorie,
      sousCategorie: this.form.sousCategorie,
      type: this.form.type,
      prix: this.form.gratuit ? 0 : Number(this.form.prix) || 0,
      gratuit: this.form.gratuit,
      auteur: '',
      faculte: '',
      matiereEnseignee: '',
      semestre: '',
      actif: this.form.actif
    };

    const requete = this.isEditMode && this.docDetail
      ? this.documentsApi.update(this.docDetail._id, payload, this.imageFile, this.fichierFile, this.imagesFiles, this.imagesExistantes)
      : this.documentsApi.create(payload, this.imageFile, this.fichierFile, this.imagesFiles, this.imagesExistantes);

    requete.subscribe({
      next: event => {
        if (event.type !== HttpEventType.Response || !event.body) return;
        const doc = event.body.document;
        if (this.isEditMode) this.remplacerDocumentLocal(doc);
        else this.documents.unshift(doc);
        this.enregistrementEnCours = false;
        this.showModalForm = false;
      },
      error: err => {
        this.enregistrementEnCours = false;
        alert(err.error?.message || "Erreur lors de l'enregistrement du document.");
      }
    });
  }

  ouvrirConsulter(d: CatalogueDocument): void { this.docDetail = d; this.showModalDetail = true; }

  ouvrirSuppression(d: CatalogueDocument): void { this.docDelete = d; this.showModalDelete = true; }

  supprimer(): void {
    if (!this.docDelete) return;
    const id = this.docDelete._id;
    this.documentsApi.remove(id).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d._id !== id);
        this.selectedIds.delete(id);
        this.showModalDelete = false; this.docDelete = null;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      },
      error: err => {
        this.showModalDelete = false; this.docDelete = null;
        alert(err.error?.message || 'Erreur lors de la suppression du document.');
      }
    });
  }

  supprimerSelection(): void {
    const ids = [...this.selectedIds];
    forkJoin(ids.map(id => this.documentsApi.remove(id).pipe(catchError(() => of(null))))).subscribe(resultats => {
      const supprimes = new Set(ids.filter((_, i) => resultats[i] !== null));
      this.documents = this.documents.filter(d => !supprimes.has(d._id));
      this.selectedIds.clear();
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    });
  }
}
