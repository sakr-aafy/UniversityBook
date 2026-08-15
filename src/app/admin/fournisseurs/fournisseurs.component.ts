import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocumentsApiService, DocumentDto, DocumentPayload } from '../../services/documents-api.service';
import { CategoriesDocumentApiService, CategorieDocumentDto } from '../../services/categories-document-api.service';
import { DropboxApiService, DropboxEntry } from '../../services/dropbox-api.service';

type ActiveTab    = 'documents' | 'promotions';
type PromoStatut  = 'active' | 'inactif' | 'expire';

interface DocNumerique extends Omit<DocumentDto, 'dateAjout'> {
  dateAjout: Date;
}

@Component({
  selector: 'app-fournisseurs',
  templateUrl: './fournisseurs.component.html',
  styleUrls: ['./fournisseurs.component.scss']
})
export class FournisseursComponent implements OnInit {

  constructor(
    private documentsApi: DocumentsApiService,
    private categoriesApi: CategoriesDocumentApiService,
    private dropboxApi: DropboxApiService
  ) {}

  // ── Data ──────────────────────────────────────────────────────────────────
  documents: DocNumerique[] = [];
  categoriesData: CategorieDocumentDto[] = [];

  get categories(): string[] {
    return this.categoriesData.map(c => c.nom);
  }

  get sousCategoriesParCategorie(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    this.categoriesData.forEach(c => map[c.nom] = c.sousCategories);
    return map;
  }

  ngOnInit(): void {
    this.chargerCategories();
    this.chargerDocuments();
  }

  private toDocNumerique(dto: DocumentDto): DocNumerique {
    return { ...dto, dateAjout: new Date(dto.dateAjout) };
  }

  private chargerDocuments(): void {
    this.documentsApi.list().subscribe({
      next: ({ documents }) => this.documents = documents.map(d => this.toDocNumerique(d)),
      error: () => { /* best-effort */ }
    });
  }

  private chargerCategories(): void {
    this.categoriesApi.list().subscribe({
      next: ({ categories }) => this.categoriesData = categories,
      error: () => { /* best-effort */ }
    });
  }

  // ── Active tab ────────────────────────────────────────────────────────────
  activeTab: ActiveTab = 'documents';

  // ── Documents tab state ───────────────────────────────────────────────────
  searchQuery        = '';
  categorieFiltre    = '';
  typeFiltre         = '';

  currentPage     = 1;
  pageSize        = 10;
  pageSizeOptions = [5, 10, 20, 50];

  sortCol = 'dateAjout';
  sortDir: 'asc' | 'desc' = 'desc';

  selectedIds = new Set<string>();

  // ── Promotions tab state ──────────────────────────────────────────────────
  promoSearch       = '';
  promoStatutFiltre = '';
  promoPage         = 1;
  promoPageSize     = 10;

  // ── Modal state ───────────────────────────────────────────────────────────
  showModalForm         = false;
  showModalDetail       = false;
  showModalDelete       = false;
  showModalPromo        = false;
  showModalCategories   = false;
  isEditMode = false;
  isPromoEdit = false;

  docDetail: DocNumerique | null = null;
  docDelete: DocNumerique | null = null;
  docPromo:  DocNumerique | null = null;

  // ── Navigateur Dropbox (formulaire "Nouveau document") ──────────────────────
  showModalDropbox   = false;
  dropboxChemin      = '';
  dropboxEntrees: DropboxEntry[] = [];
  dropboxChargement  = false;
  dropboxErreur      = '';

  // ── Forms ─────────────────────────────────────────────────────────────────
  form = {
    nom: '', categorie: 'Gestion', sousCategorie: '', description: '',
    fichierDropboxPath: '',
    prix: 0, prixPromo: 0, debutPromo: '', finPromo: '',
    typeDoc: 'payant' as 'payant' | 'gratuit',
  };

  promoForm = {
    documentId: '', prixPromo: 0, debutPromo: '', finPromo: '',
  };

  // ── Helper getters ────────────────────────────────────────────────────────
  get docsPayantsEligibles(): DocNumerique[] {
    return this.documents.filter(d => d.typeDoc === 'payant');
  }

  // ── Stat getters ──────────────────────────────────────────────────────────
  get totalDocs(): number          { return this.documents.length; }
  get docsPayants(): number        { return this.documents.filter(d => d.typeDoc === 'payant').length; }
  get docsGratuits(): number       { return this.documents.filter(d => d.typeDoc === 'gratuit').length; }
  get totalTelechargements(): number { return this.documents.reduce((s, d) => s + d.telechargements, 0); }
  get revenuTotal(): number        { return this.documents.reduce((s, d) => s + d.prix * d.ventes, 0); }

  get expirantBientot(): number {
    const now = new Date(), soon = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    return this.documents.filter(d => {
      if (!d.finPromo) return false;
      const fin = new Date(d.finPromo);
      return fin >= now && fin <= soon;
    }).length;
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  promoActive(d: DocNumerique): boolean {
    if (!d.prixPromo || !d.finPromo) return false;
    const now = new Date(), fin = new Date(d.finPromo);
    const deb = d.debutPromo ? new Date(d.debutPromo) : now;
    return now >= deb && now <= fin;
  }

  getPrix(d: DocNumerique): number {
    return this.promoActive(d) ? d.prixPromo : d.prix;
  }

  getPromoStatut(d: DocNumerique): PromoStatut {
    if (!d.prixPromo || !d.finPromo) return 'inactif';
    const now = new Date(), fin = new Date(d.finPromo);
    const deb = d.debutPromo ? new Date(d.debutPromo) : now;
    if (fin < now) return 'expire';
    if (deb > now) return 'inactif';
    return 'active';
  }

  getDiscountPct(d: DocNumerique): number {
    if (!d.prix || !d.prixPromo) return 0;
    return Math.round((1 - d.prixPromo / d.prix) * 100);
  }

  get promoDiscountPreview(): number {
    const doc = this.documents.find(d => d.id === this.promoForm.documentId);
    if (!doc || !doc.prix || !this.promoForm.prixPromo) return 0;
    return Math.round((1 - Number(this.promoForm.prixPromo) / doc.prix) * 100);
  }

  // ── Documents tab getters ─────────────────────────────────────────────────
  get documentsFiltres(): DocNumerique[] {
    let r = [...this.documents];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      r = r.filter(d => d.nom.toLowerCase().includes(q) || d.categorie.toLowerCase().includes(q));
    }
    if (this.categorieFiltre) r = r.filter(d => d.categorie === this.categorieFiltre);
    if (this.typeFiltre)      r = r.filter(d => d.typeDoc   === this.typeFiltre);

    r.sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortCol) {
        case 'nom':             va = a.nom;             vb = b.nom;             break;
        case 'categorie':       va = a.categorie;       vb = b.categorie;       break;
        case 'prix':            va = a.prix;            vb = b.prix;            break;
        case 'telechargements': va = a.telechargements; vb = b.telechargements; break;
        default:                va = a.dateAjout.getTime(); vb = b.dateAjout.getTime();
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.documentsFiltres.length / this.pageSize)); }
  get documentsPagines(): DocNumerique[] { const s = (this.currentPage - 1) * this.pageSize; return this.documentsFiltres.slice(s, s + this.pageSize); }

  get paginationInfo(): string {
    const total = this.documentsFiltres.length;
    if (!total) return 'Aucun document trouvé';
    const s = (this.currentPage - 1) * this.pageSize + 1, e = Math.min(this.currentPage * this.pageSize, total);
    return `${s}–${e} sur ${total} documents`;
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.categorieFiltre || this.typeFiltre);
  }

  // ── Promotions tab getters ────────────────────────────────────────────────
  get docsAvecPromo(): DocNumerique[] {
    return this.documents.filter(d => d.typeDoc === 'payant' && d.prixPromo > 0 && !!d.finPromo);
  }

  get docsAvecPromoFiltres(): DocNumerique[] {
    let r = [...this.docsAvecPromo];
    if (this.promoSearch) {
      const q = this.promoSearch.toLowerCase();
      r = r.filter(d => d.nom.toLowerCase().includes(q) || d.categorie.toLowerCase().includes(q));
    }
    if (this.promoStatutFiltre) r = r.filter(d => this.getPromoStatut(d) === this.promoStatutFiltre);
    return r;
  }

  get promoTotalPages(): number { return Math.max(1, Math.ceil(this.docsAvecPromoFiltres.length / this.promoPageSize)); }
  get promoPaginees(): DocNumerique[] { const s = (this.promoPage - 1) * this.promoPageSize; return this.docsAvecPromoFiltres.slice(s, s + this.promoPageSize); }
  get docsPromoExpirees(): number { return this.docsAvecPromo.filter(d => this.getPromoStatut(d) === 'expire').length; }

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

  get pageNumbers(): (number | -1)[]        { return this.buildPages(this.currentPage, this.totalPages); }
  get promoPageNumbers(): (number | -1)[]   { return this.buildPages(this.promoPage, this.promoTotalPages); }

  // ── Selection ─────────────────────────────────────────────────────────────
  get allSelected(): boolean { return this.documentsPagines.length > 0 && this.documentsPagines.every(d => this.selectedIds.has(d.id)); }
  get someSelected(): boolean { return this.selectedIds.size > 0; }
  toggleAll(): void { if (this.allSelected) this.documentsPagines.forEach(d => this.selectedIds.delete(d.id)); else this.documentsPagines.forEach(d => this.selectedIds.add(d.id)); }
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

  // ── Promotions CRUD ───────────────────────────────────────────────────────
  ouvrirAjoutPromo(): void {
    this.isPromoEdit = false;
    this.docPromo    = null;
    const docId = this.docsPayantsEligibles[0]?.id ?? '';
    this.promoForm = { documentId: docId, prixPromo: 0, debutPromo: '', finPromo: '' };
    this.showModalPromo = true;
  }

  ouvrirModifPromo(d: DocNumerique): void {
    this.isPromoEdit = true;
    this.docPromo    = d;
    this.promoForm   = { documentId: d.id, prixPromo: d.prixPromo, debutPromo: d.debutPromo, finPromo: d.finPromo };
    this.showModalPromo = true;
  }

  sauvegarderPromo(): void {
    if (!this.promoForm.documentId || !this.promoForm.prixPromo || !this.promoForm.finPromo) return;
    this.documentsApi.update(this.promoForm.documentId, {
      prixPromo: Number(this.promoForm.prixPromo),
      debutPromo: this.promoForm.debutPromo,
      finPromo: this.promoForm.finPromo,
    }).subscribe({
      next: ({ document }) => {
        this.remplacerDocumentLocal(document);
        this.showModalPromo = false;
      },
      error: err => alert(err.error?.message || "Erreur lors de l'enregistrement de la promotion.")
    });
  }

  supprimerPromo(d: DocNumerique): void {
    this.documentsApi.update(d.id, { prixPromo: 0, debutPromo: '', finPromo: '' }).subscribe({
      next: ({ document }) => this.remplacerDocumentLocal(document),
      error: err => alert(err.error?.message || 'Erreur lors de la suppression de la promotion.')
    });
  }

  togglePromoActive(d: DocNumerique): void {
    const status = this.getPromoStatut(d);
    const now = new Date();
    const payload: Partial<DocumentPayload> = status === 'active'
      ? { finPromo: new Date(now.getTime() - 86400000).toISOString().slice(0, 10) }
      : { debutPromo: now.toISOString().slice(0, 10), finPromo: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10) };
    this.documentsApi.update(d.id, payload).subscribe({
      next: ({ document }) => this.remplacerDocumentLocal(document),
      error: err => alert(err.error?.message || 'Erreur lors de la mise à jour de la promotion.')
    });
  }

  private remplacerDocumentLocal(dto: DocumentDto): void {
    const updated = this.toDocNumerique(dto);
    const idx = this.documents.findIndex(d => d.id === updated.id);
    if (idx >= 0) this.documents[idx] = updated;
  }

  // ── Documents CRUD ────────────────────────────────────────────────────────
  ouvrirAjout(): void {
    this.isEditMode = false; this.docDetail = null;
    const categorie = this.categories[0] ?? 'Gestion';
    this.form = { nom: '', categorie, sousCategorie: this.sousCategoriesParCategorie[categorie]?.[0] ?? '', description: '', fichierDropboxPath: '', prix: 0, prixPromo: 0, debutPromo: '', finPromo: '', typeDoc: 'payant' };
    this.showModalForm = true;
  }

  ouvrirModification(d: DocNumerique): void {
    this.isEditMode = true; this.docDetail = d;
    this.form = { nom: d.nom, categorie: d.categorie, sousCategorie: d.sousCategorie, description: d.description, fichierDropboxPath: d.fichierDropboxPath, prix: d.prix, prixPromo: d.prixPromo, debutPromo: d.debutPromo, finPromo: d.finPromo, typeDoc: d.typeDoc };
    this.showModalForm = true;
  }

  sauvegarder(): void {
    if (!this.form.nom.trim()) return;
    const payload: DocumentPayload = {
      nom: this.form.nom, categorie: this.form.categorie, sousCategorie: this.form.sousCategorie,
      description: this.form.description, fichierDropboxPath: this.form.fichierDropboxPath,
      prix: this.form.prix, prixPromo: this.form.prixPromo,
      debutPromo: this.form.debutPromo, finPromo: this.form.finPromo, typeDoc: this.form.typeDoc
    };
    if (this.isEditMode && this.docDetail) {
      this.documentsApi.update(this.docDetail.id, payload).subscribe({
        next: ({ document }) => {
          this.remplacerDocumentLocal(document);
          this.showModalForm = false;
        },
        error: err => alert(err.error?.message || 'Erreur lors de la mise à jour du document.')
      });
    } else {
      this.documentsApi.create(payload).subscribe({
        next: ({ document }) => {
          this.documents.unshift(this.toDocNumerique(document));
          this.showModalForm = false;
        },
        error: err => alert(err.error?.message || "Erreur lors de l'enregistrement du document.")
      });
    }
  }

  // ── Navigateur Dropbox ────────────────────────────────────────────────────
  /** Ouvre le sélecteur de fichier Dropbox pour lier un document existant au lieu de le
   * re-décrire manuellement — démarre au dossier déjà lié s'il y en a un, sinon à la racine. */
  ouvrirDropboxBrowser(): void {
    this.showModalDropbox = true;
    const depart = this.form.fichierDropboxPath
      ? this.form.fichierDropboxPath.split('/').slice(0, -1).join('/')
      : '';
    this.naviguerDropbox(depart);
  }

  fermerDropboxBrowser(): void {
    this.showModalDropbox = false;
  }

  naviguerDropbox(chemin: string): void {
    this.dropboxChargement = true;
    this.dropboxErreur = '';
    this.dropboxApi.list(chemin).subscribe({
      next: ({ chemin: c, entrees }) => {
        this.dropboxChemin = c === '/' ? '' : c;
        this.dropboxEntrees = entrees;
        this.dropboxChargement = false;
      },
      error: err => {
        this.dropboxErreur = err.error?.message || 'Erreur lors du chargement du dossier Dropbox.';
        this.dropboxChargement = false;
      }
    });
  }

  ouvrirDropboxEntree(entree: DropboxEntry): void {
    if (entree.type === 'dossier') {
      this.naviguerDropbox(entree.chemin);
    } else {
      this.form.fichierDropboxPath = entree.chemin;
      this.showModalDropbox = false;
    }
  }

  dropboxRemonter(): void {
    const parent = this.dropboxChemin.split('/').slice(0, -1).join('/');
    this.naviguerDropbox(parent);
  }

  detacherFichierDropbox(): void {
    this.form.fichierDropboxPath = '';
  }

  /** Réinitialise la sous-catégorie sélectionnée quand la catégorie change (options dépendantes). */
  onCategorieChange(): void {
    const options = this.sousCategoriesParCategorie[this.form.categorie] ?? [];
    this.form.sousCategorie = options[0] ?? '';
  }

  // ── Gestion des catégories / sous-catégories ─────────────────────────────
  newCategorieNom = '';
  newSousCategorieCategorie = '';
  newSousCategorieNom = '';

  ouvrirGestionCategories(): void {
    this.newCategorieNom = '';
    this.newSousCategorieCategorie = this.form.categorie || this.categories[0] || '';
    this.newSousCategorieNom = '';
    this.showModalCategories = true;
  }

  ajouterCategorie(): void {
    const nom = this.newCategorieNom.trim();
    if (!nom || this.categories.includes(nom)) return;
    this.categoriesApi.create(nom).subscribe({
      next: ({ categorie }) => {
        this.categoriesData.push(categorie);
        this.newCategorieNom = '';
        this.newSousCategorieCategorie = categorie.nom;
      },
      error: err => alert(err.error?.message || 'Erreur lors de la création de la catégorie.')
    });
  }

  ajouterSousCategorie(): void {
    const catNom = this.newSousCategorieCategorie;
    const nom = this.newSousCategorieNom.trim();
    if (!catNom || !nom) return;
    const cat = this.categoriesData.find(c => c.nom === catNom);
    if (!cat) return;
    this.categoriesApi.ajouterSousCategorie(cat.id, nom).subscribe({
      next: ({ categorie }) => {
        const idx = this.categoriesData.findIndex(c => c.id === categorie.id);
        if (idx >= 0) this.categoriesData[idx] = categorie;
        this.newSousCategorieNom = '';
      },
      error: err => alert(err.error?.message || "Erreur lors de l'ajout de la sous-catégorie.")
    });
  }

  ouvrirConsulter(d: DocNumerique): void { this.docDetail = d; this.showModalDetail = true; }

  ouvrirSuppression(d: DocNumerique): void { this.docDelete = d; this.showModalDelete = true; }

  supprimer(): void {
    if (!this.docDelete) return;
    const id = this.docDelete.id;
    this.documentsApi.remove(id).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d.id !== id);
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
      this.documents = this.documents.filter(d => !supprimes.has(d.id));
      this.selectedIds.clear();
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    });
  }

  telecharger(d: DocNumerique): void {
    this.documentsApi.telecharger(d.id).subscribe({
      next: ({ document }) => this.remplacerDocumentLocal(document),
      error: () => { /* best-effort */ }
    });
  }
}
