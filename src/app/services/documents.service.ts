import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PurchasedDocument {
  _id: string;
  titre: string;
  image: string;
  categorie: string;
  fichierUrl: string;
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

  /** Documents gratuits : crée directement l'accès dans Mes Documents, sans passer par le panier/la commande. */
  acquerirGratuit(payload: {
    titre: string; image?: string; categorie?: string; type?: string; auteur?: string; produitId?: number;
  }): Observable<{ message: string; document: PurchasedDocument }> {
    return this.http.post<{ message: string; document: PurchasedDocument }>(`${this.apiUrl}/acquerir-gratuit`, payload);
  }
}
