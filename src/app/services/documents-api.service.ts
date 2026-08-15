import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TypeDoc = 'payant' | 'gratuit';
export type StatutPaiementDoc = 'payé' | 'gratuit' | 'non-payé' | 'partiel';

export interface DocumentDto {
  id: string;
  nom: string;
  categorie: string;
  sousCategorie: string;
  description: string;
  fichierDropboxPath: string;
  prix: number;
  prixPromo: number;
  debutPromo: string;
  finPromo: string;
  typeDoc: TypeDoc;
  ventes: number;
  telechargements: number;
  statutPaiement: StatutPaiementDoc;
  dateAjout: string;
}

export interface DocumentPayload {
  nom: string;
  categorie: string;
  sousCategorie?: string;
  description?: string;
  fichierDropboxPath?: string;
  prix?: number;
  prixPromo?: number;
  debutPromo?: string;
  finPromo?: string;
  typeDoc?: TypeDoc;
}

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly base = `${environment.apiUrl}/caisse/documents`;

  constructor(private http: HttpClient) {}

  list(params: Record<string, string> = {}): Observable<{ documents: DocumentDto[]; total: number }> {
    return this.http.get<{ documents: DocumentDto[]; total: number }>(this.base, {
      params: { limite: '1000', ...params }
    });
  }

  create(payload: DocumentPayload): Observable<{ message: string; document: DocumentDto }> {
    return this.http.post<{ message: string; document: DocumentDto }>(this.base, payload);
  }

  update(id: string, payload: Partial<DocumentPayload>): Observable<{ message: string; document: DocumentDto }> {
    return this.http.put<{ message: string; document: DocumentDto }>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  telecharger(id: string): Observable<{ message: string; document: DocumentDto }> {
    return this.http.post<{ message: string; document: DocumentDto }>(`${this.base}/${id}/telecharger`, {});
  }
}
