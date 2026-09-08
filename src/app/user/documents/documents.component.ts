import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  DocumentsService, PurchasedDocument, DocumentPropose, PropositionForm, StatutProposition,
  CategorieArbreDoc
} from '../../services/documents.service';

const FENETRE_TELECHARGEMENT_MS = 24 * 60 * 60 * 1000;
const SEUIL_ALERTE_MS = 60 * 60 * 1000;

/** Extensions acceptées pour le fichier d'une proposition — miroir de
 *  uploadDocumentCatalogue.middleware.js côté backend. */
const EXT_FICHIER_ACCEPTEES = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip'];
const TAILLE_MAX_FICHIER = 50 * 1024 * 1024;

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent implements OnInit, OnDestroy {
  documents: PurchasedDocument[] = [];
  chargement: boolean = true;
  erreur: string = '';
  message: string = '';

  recherche: string = '';
  page: number = 1;
  totalPages: number = 1;

  documentSelectionne: PurchasedDocument | null = null;
  private minuteur?: ReturnType<typeof setInterval>;

  // ── « Proposer un document » ──────────────────────────────────────────────
  showProposerModal = false;
  categoriesArbre: CategorieArbreDoc[] = [];
  propositionForm: PropositionForm = { titre: '', description: '', categorie: '', sousCategorie: '', type: '' };
  propositionFichier: File | null = null;
  propositionFichierNom = '';
  propositionImage: File | null = null;
  propositionImageApercu = '';
  envoiEnCours = false;
  progressionUpload = 0;
  propositionErreur = '';
  readonly extFichierLabel = EXT_FICHIER_ACCEPTEES.map(e => e.slice(1).toUpperCase()).join(', ');
  readonly accepteFichier = EXT_FICHIER_ACCEPTEES.join(',');

  // ── « Mes propositions » ─────────────────────────────────────────────────
  propositions: DocumentPropose[] = [];
  chargementPropositions = false;

  constructor(private documentsService: DocumentsService, private router: Router) {}

  ngOnInit(): void {
    this.charger();
    this.chargerPropositions();
    // Force le recalcul du compte à rebours (et de l'expiration) affiché sans recharger les données.
    this.minuteur = setInterval(() => {}, 30000);
  }

  ngOnDestroy(): void {
    if (this.minuteur) clearInterval(this.minuteur);
  }

  charger(): void {
    this.chargement = true;
    this.documentsService.list({ recherche: this.recherche, page: this.page, limite: 9 }).subscribe({
      next: res => {
        this.documents = res.documents;
        this.totalPages = res.totalPages || 1;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger vos documents.';
        this.chargement = false;
      }
    });
  }

  rechercher(): void {
    this.page = 1;
    this.charger();
  }

  pagePrecedente(): void {
    if (this.page > 1) {
      this.page--;
      this.charger();
    }
  }

  pageSuivante(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.charger();
    }
  }

  /** Un document GRATUIT n'a pas de fenêtre de 24h : accès illimité, téléchargeable à volonté
   *  (même règle que documents.controller.js#telecharger côté backend — voir plus bas). Seuls
   *  les documents PAYANTS restent soumis au compte à rebours de 24h. */
  estGratuit(doc: PurchasedDocument): boolean {
    return !doc.prix;
  }

  /** Millisecondes restantes avant expiration de la fenêtre de téléchargement de 24h
   *  (uniquement pertinent pour un document payant, voir estGratuit). */
  private msRestantes(doc: PurchasedDocument): number {
    const expireLe = new Date(doc.dateAchat).getTime() + FENETRE_TELECHARGEMENT_MS;
    return expireLe - Date.now();
  }

  estExpire(doc: PurchasedDocument): boolean {
    if (this.estGratuit(doc)) return false;
    return this.msRestantes(doc) <= 0;
  }

  procheExpiration(doc: PurchasedDocument): boolean {
    if (this.estGratuit(doc)) return false;
    const ms = this.msRestantes(doc);
    return ms > 0 && ms <= SEUIL_ALERTE_MS;
  }

  /** Compte à rebours détaillé (ex. "23 h 59 min", "32 min"), mis à jour en direct par le minuteur ci-dessus. */
  tempsRestant(doc: PurchasedDocument): string {
    const ms = this.msRestantes(doc);
    if (ms <= 0) return 'Expiré';
    const minutesTotales = Math.floor(ms / 60000);
    const heures = Math.floor(minutesTotales / 60);
    const minutes = minutesTotales % 60;
    if (heures <= 0) return `${minutes} min`;
    return `${heures} h ${minutes} min`;
  }

  /** Documents dont l'accès expire dans moins d'une heure — alimente la bannière d'alerte. */
  get documentsProchesExpiration(): PurchasedDocument[] {
    return this.documents.filter(d => this.procheExpiration(d));
  }

  telechargementEnCoursId: string | null = null;

  telecharger(doc: PurchasedDocument): void {
    this.message = '';
    if (this.estExpire(doc) || this.telechargementEnCoursId) return;
    this.documentsService.telecharger(doc._id).subscribe({
      next: res => {
        // Reprend TOUJOURS l'état renvoyé par le backend (source de vérité, notamment
        // fichierUrl) plutôt que la copie locale — la liste peut avoir été chargée avant qu'un
        // fichier ne soit associé au document côté catalogue.
        doc.telechargements = res.document.telechargements;
        doc.derniereTelechargementLe = res.document.derniereTelechargementLe;
        doc.fichierUrl = res.document.fichierUrl;
        doc.fichierDropboxPath = res.document.fichierDropboxPath;
        if (!doc.fichierUrl && !doc.fichierDropboxPath) {
          this.message = "Aucun fichier n'est encore associé à ce document. Contactez le support pour l'obtenir.";
          return;
        }
        this.enregistrerSurAppareil(doc);
      },
      error: err => {
        this.message = err.error?.message || 'Erreur lors du téléchargement.';
      }
    });
  }

  /**
   * Déclenche un VRAI enregistrement local du fichier (boîte "Enregistrer sous" / dossier
   * Téléchargements), au lieu de simplement l'ouvrir dans un nouvel onglet — `window.open()` sur
   * l'URL R2 directement laissait le navigateur afficher le PDF inline, sans jamais proposer de
   * téléchargement. Récupère les octets via le backend (Content-Disposition: attachment, voir
   * documents.controller.js#telechargerFichier) puis les enregistre via un lien `<a download>`
   * temporaire — même mécanisme que user/commandes/commandes.component.ts#telechargerFacture.
   */
  /** Extensions courantes par type MIME — repli quand ni l'URL ni le chemin du fichier n'en
   *  portent (Word, PowerPoint, Excel, texte, archives, images…). */
  private static readonly EXT_PAR_MIME: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.oasis.opendocument.text': '.odt',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.oasis.opendocument.presentation': '.odp',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.oasis.opendocument.spreadsheet': '.ods',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/rtf': '.rtf',
    'text/rtf': '.rtf',
    'application/zip': '.zip',
    'application/epub+zip': '.epub',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };

  /** Extension du fichier : depuis l'URL/le chemin (query et hash retirés), sinon depuis le type
   *  MIME du blob renvoyé par le backend, sinon repli `.pdf`. */
  private extensionFichier(doc: PurchasedDocument, blob: Blob): string {
    const source = (doc.fichierUrl || doc.fichierDropboxPath || '').split(/[?#]/)[0];
    const m = source.match(/(\.[a-z0-9]{1,8})$/i);
    if (m) return m[1].toLowerCase();
    return DocumentsComponent.EXT_PAR_MIME[(blob.type || '').split(';')[0].trim().toLowerCase()] || '.pdf';
  }

  private enregistrerSurAppareil(doc: PurchasedDocument): void {
    this.telechargementEnCoursId = doc._id;
    this.documentsService.telechargerFichier(doc._id).subscribe({
      next: blob => {
        this.telechargementEnCoursId = null;
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        const nomBase = (doc.titre || 'document').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 100) || 'document';
        lien.download = `${nomBase}${this.extensionFichier(doc, blob)}`;
        lien.click();
        URL.revokeObjectURL(url);
      },
      error: err => {
        this.telechargementEnCoursId = null;
        this.message = err?.error?.message || "Erreur lors de l'enregistrement du fichier. Réessayez.";
      }
    });
  }

  ajouterFavoris(doc: PurchasedDocument): void {
    this.message = '';
    this.documentsService.addToFavorites(doc._id).subscribe({
      next: res => (this.message = res.message),
      error: err => (this.message = err.error?.message || "Erreur lors de l'ajout aux favoris.")
    });
  }

  /** Accès expiré : renvoie vers la fiche produit (ou la boutique si le lien d'origine est inconnu). */
  racheter(doc: PurchasedDocument): void {
    if (doc.produitId) {
      this.router.navigate(['/produit', doc.produitId]);
    } else {
      this.router.navigate(['/boutique']);
    }
  }

  voirDetail(doc: PurchasedDocument): void {
    this.documentSelectionne = doc;
  }

  fermerDetail(): void {
    this.documentSelectionne = null;
  }

  trackById(_index: number, item: PurchasedDocument): string {
    return item._id;
  }

  // ── « Proposer un document » ─────────────────────────────────────────────

  ouvrirProposer(): void {
    this.propositionForm = { titre: '', description: '', categorie: '', sousCategorie: '', type: '' };
    this.propositionFichier = null;
    this.propositionFichierNom = '';
    this.propositionImage = null;
    this.propositionImageApercu = '';
    this.propositionErreur = '';
    this.progressionUpload = 0;
    this.showProposerModal = true;
    if (this.categoriesArbre.length === 0) {
      this.documentsService.categoriesDocumentsArbre().subscribe({
        next: cats => (this.categoriesArbre = cats || []),
        error: () => { /* les sélecteurs restent vides si l'API échoue — catégorie non obligatoire */ }
      });
    }
  }

  /** Sous-catégories de la catégorie actuellement sélectionnée dans le formulaire de proposition. */
  get sousCategoriesDispo(): string[] {
    return this.categoriesArbre.find(c => c.nom === this.propositionForm.categorie)?.sousCategories || [];
  }

  /** Changement de catégorie : on remet la sous-catégorie à zéro (celle d'avant n'appartient
   *  plus forcément à la nouvelle catégorie). */
  onPropCategorieChange(): void {
    this.propositionForm.sousCategorie = '';
  }

  fermerProposer(): void {
    if (this.envoiEnCours) return;
    this.showProposerModal = false;
  }

  onPropositionFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ext = ('.' + (file.name.split('.').pop() || '')).toLowerCase();
    if (!EXT_FICHIER_ACCEPTEES.includes(ext)) {
      this.propositionErreur = `Format non supporté. Fichiers acceptés : ${this.extFichierLabel}.`;
      return;
    }
    if (file.size > TAILLE_MAX_FICHIER) {
      this.propositionErreur = 'Le fichier dépasse la taille maximale de 50 Mo.';
      return;
    }
    this.propositionErreur = '';
    this.propositionFichier = file;
    this.propositionFichierNom = file.name;
  }

  onPropositionImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.propositionErreur = 'Image invalide (JPEG, PNG ou WEBP uniquement).';
      return;
    }
    this.propositionErreur = '';
    this.propositionImage = file;
    const lecteur = new FileReader();
    lecteur.onload = () => (this.propositionImageApercu = lecteur.result as string);
    lecteur.readAsDataURL(file);
  }

  retirerPropositionImage(): void {
    this.propositionImage = null;
    this.propositionImageApercu = '';
  }

  envoyerProposition(): void {
    if (this.envoiEnCours) return;
    this.propositionErreur = '';
    if (!this.propositionForm.titre.trim()) {
      this.propositionErreur = 'Le titre du document est requis.';
      return;
    }
    if (!this.propositionFichier) {
      this.propositionErreur = 'Veuillez joindre le fichier du document.';
      return;
    }
    this.envoiEnCours = true;
    this.progressionUpload = 0;
    this.documentsService.proposerDocument(
      { ...this.propositionForm, titre: this.propositionForm.titre.trim() },
      this.propositionFichier,
      this.propositionImage
    ).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progressionUpload = Math.round((event.loaded / event.total) * 100);
        } else if (event.type === HttpEventType.Response) {
          this.envoiEnCours = false;
          this.showProposerModal = false;
          this.message = event.body?.message
            || 'Votre document a été soumis. Il sera examiné par un administrateur avant publication.';
          this.chargerPropositions();
        }
      },
      error: err => {
        this.envoiEnCours = false;
        this.propositionErreur = err?.error?.message || "Erreur lors de l'envoi de votre proposition. Réessayez.";
      }
    });
  }

  // ── « Mes propositions » ────────────────────────────────────────────────

  chargerPropositions(): void {
    this.chargementPropositions = true;
    this.documentsService.mesPropositions().subscribe({
      next: res => {
        this.propositions = res.propositions || [];
        this.chargementPropositions = false;
      },
      error: () => {
        this.propositions = [];
        this.chargementPropositions = false;
      }
    });
  }

  libelleStatut(s: StatutProposition): string {
    return s === 'approuve' ? 'Approuvé' : s === 'refuse' ? 'Refusé' : 'En attente';
  }

  trackByPropId(_index: number, item: DocumentPropose): string {
    return item._id;
  }
}
