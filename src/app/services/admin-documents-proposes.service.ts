import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutProposition = 'en_attente' | 'approuve' | 'refuse';

export interface DocumentProposeAdmin {
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
  proposeParNom: string;
  proposeParEmail: string;
  documentCatalogueId: string | null;
  traitePar: string;
  traiteLe?: string;
  createdAt: string;
}

export interface PropositionsResponse {
  propositions: DocumentProposeAdmin[];
  nbEnAttente: number;
}

/**
 * Documents proposés par les utilisateurs (Admin > Documents proposés). L'approbation crée
 * automatiquement un DocumentCatalogue public gratuit — voir
 * backend/controllers/documentsProposes.controller.js.
 */
@Injectable({ providedIn: 'root' })
export class AdminDocumentsProposesService {
  private readonly apiUrl = `${environment.apiUrl}/admin/documents-proposes`;

  constructor(private http: HttpClient) {}

  list(statut?: StatutProposition | ''): Observable<PropositionsResponse> {
    let params = new HttpParams();
    if (statut) params = params.set('statut', statut);
    return this.http.get<PropositionsResponse>(this.apiUrl, { params });
  }

  approuver(id: string): Observable<{ message: string; proposition: DocumentProposeAdmin }> {
    return this.http.post<{ message: string; proposition: DocumentProposeAdmin }>(`${this.apiUrl}/${id}/approuver`, {});
  }

  refuser(id: string, motif: string): Observable<{ message: string; proposition: DocumentProposeAdmin }> {
    return this.http.post<{ message: string; proposition: DocumentProposeAdmin }>(`${this.apiUrl}/${id}/refuser`, { motif });
  }

  supprimer(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
