import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PurchasedDocument {
  _id: string;
  titre: string;
  image: string;
  categorie: string;
  fichierUrl: string;
  // Repli quand le document provient du catalogue caisse (Dropbox) plutôt que du catalogue
  // natif frontweb — voir documents.controller.js#resynchroniserFichierUrl. Résolu à la demande
  // côté backend, jamais exploitable tel quel côté client.
  fichierDropboxPath?: string;
  dateAchat: string;
  prix?: number;
  telechargements?: number;
  derniereTelechargementLe?: string | null;
  numeroCommande?: string;
  produitId?: number;
  type?: string;
  auteur?: string;
}

export interface DocumentsResponse {
  documents: PurchasedDocument[];
  total: number;
  page: number;
  totalPages: number;
}

export type StatutProposition = 'en_attente' | 'approuve' | 'refuse';

/** Document proposé par l'utilisateur, en attente de validation par un administrateur. */
export interface DocumentPropose {
  _id: string;
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
  image: string;
  fichier: string;
  fichierNom: string;
  statut: StatutProposition;
  motifRefus: string;
  createdAt: string;
  traiteLe?: string;
}

export interface PropositionForm {
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
}

/** Catégorie de documents + ses sous-catégories (par nom) — sélecteurs du formulaire de proposition. */
export interface CategorieArbreDoc {
  nom: string;
  sousCategories: string[];
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly apiUrl = `${environment.apiUrl}/documents`;

  constructor(private http: HttpClient) {}

  list(options: { recherche?: string; categorie?: string; page?: number; limite?: number } = {}): Observable<DocumentsResponse> {
    let params = new HttpParams();
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.categorie) params = params.set('categorie', options.categorie);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    return this.http.get<DocumentsResponse>(this.apiUrl, { params });
  }

  addToFavorites(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/favoris`, {});
  }

  telecharger(id: string): Observable<{ message: string; document: PurchasedDocument }> {
    return this.http.post<{ message: string; document: PurchasedDocument }>(`${this.apiUrl}/${id}/telecharger`, {});
  }

  /** Octets réels du fichier (Content-Disposition: attachment côté backend), à appeler après
   *  `telecharger()` — voir documents.component.ts#telecharger pour le déclenchement de
   *  l'enregistrement local (URL.createObjectURL + <a download>), même mécanisme que
   *  orders.service.ts#telechargerFacture. */
  telechargerFichier(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/fichier`, { responseType: 'blob' });
  }

  /** Documents gratuits : crée directement l'accès dans Mes Documents, sans passer par le panier/la commande. */
  acquerirGratuit(payload: {
    titre: string; image?: string; categorie?: string; type?: string; auteur?: string; produitId?: number;
  }): Observable<{ message: string; document: PurchasedDocument }> {
    return this.http.post<{ message: string; document: PurchasedDocument }>(`${this.apiUrl}/acquerir-gratuit`, payload);
  }

  /** Catégories "Documents" + leurs sous-catégories (arbre) — alimente les deux sélecteurs
   *  Catégorie / Sous-Catégorie du formulaire « Proposer un document ». Endpoint public. */
  categoriesDocumentsArbre(): Observable<CategorieArbreDoc[]> {
    return this.http.get<CategorieArbreDoc[]>(`${environment.apiUrl}/catalogue/categories-arbre`, {
      params: new HttpParams().set('type', 'documents')
    });
  }

  /** Propositions de documents de l'utilisateur connecté (section « Mes propositions »). */
  mesPropositions(): Observable<{ propositions: DocumentPropose[] }> {
    return this.http.get<{ propositions: DocumentPropose[] }>(`${this.apiUrl}/propositions`);
  }

  /** Soumet un document à la validation d'un administrateur. `observe:'events'` + `reportProgress`
   *  pour une vraie barre de progression pendant l'upload du fichier (même schéma que
   *  admin-documents.service.ts#create). */
  proposerDocument(
    data: PropositionForm,
    fichier: File,
    image?: File | null
  ): Observable<HttpEvent<{ message: string; proposition: DocumentPropose }>> {
    const formData = new FormData();
    formData.append('titre', data.titre);
    formData.append('description', data.description || '');
    formData.append('categorie', data.categorie || '');
    formData.append('sousCategorie', data.sousCategorie || '');
    formData.append('type', data.type || '');
    formData.append('fichier', fichier);
    if (image) formData.append('image', image);
    return this.http.post<{ message: string; proposition: DocumentPropose }>(
      `${this.apiUrl}/propositions`,
      formData,
      { reportProgress: true, observe: 'events' }
    );
  }
}
