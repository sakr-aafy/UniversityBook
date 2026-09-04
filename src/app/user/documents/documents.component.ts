import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentsService, PurchasedDocument } from '../../services/documents.service';

const FENETRE_TELECHARGEMENT_MS = 24 * 60 * 60 * 1000;
const SEUIL_ALERTE_MS = 60 * 60 * 1000;

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

  constructor(private documentsService: DocumentsService, private router: Router) {}

  ngOnInit(): void {
    this.charger();
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
        if (!doc.fichierUrl) {
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
  private enregistrerSurAppareil(doc: PurchasedDocument): void {
    this.telechargementEnCoursId = doc._id;
    this.documentsService.telechargerFichier(doc._id).subscribe({
      next: blob => {
        this.telechargementEnCoursId = null;
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        const extension = (doc.fichierUrl.match(/\.[a-z0-9]+$/i)?.[0]) || '.pdf';
        lien.download = `${doc.titre || 'document'}${extension}`;
        lien.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.telechargementEnCoursId = null;
        this.message = "Erreur lors de l'enregistrement du fichier. Réessayez.";
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
}
