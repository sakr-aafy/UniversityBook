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

  /** Millisecondes restantes avant expiration de la fenêtre de téléchargement de 24h. */
  private msRestantes(doc: PurchasedDocument): number {
    const expireLe = new Date(doc.dateAchat).getTime() + FENETRE_TELECHARGEMENT_MS;
    return expireLe - Date.now();
  }

  estExpire(doc: PurchasedDocument): boolean {
    return this.msRestantes(doc) <= 0;
  }

  procheExpiration(doc: PurchasedDocument): boolean {
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

  telecharger(doc: PurchasedDocument): void {
    this.message = '';
    if (this.estExpire(doc)) return;
    this.documentsService.telecharger(doc._id).subscribe({
      next: res => {
        doc.telechargements = res.document.telechargements;
        doc.derniereTelechargementLe = res.document.derniereTelechargementLe;
        if (doc.fichierUrl) {
          window.open(doc.fichierUrl, '_blank');
        } else {
          this.message = 'Fichier non disponible pour cette démonstration (aucun document réel associé).';
        }
      },
      error: err => {
        this.message = err.error?.message || 'Erreur lors du téléchargement.';
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
