import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CatalogueDocument {
  _id: string;
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
  prix: number;
  gratuit: boolean;
  image: string;
  images: string[];
  fichier: string;
  actif: boolean;
  auteur: string;
  editeur: string;
  faculte: string;
  matiereEnseignee: string;
  semestre: string;
  createdAt: string;
}

export interface CatalogueDocumentsResponse {
  documents: CatalogueDocument[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DocumentCatalogueForm {
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
  prix: number;
  gratuit: boolean;
  auteur: string;
  faculte: string;
  matiereEnseignee: string;
  semestre: string;
  actif?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminDocumentsService {
  private readonly apiUrl = `${environment.apiUrl}/admin/documents-catalogue`;

  constructor(private http: HttpClient) {}

  list(options: { recherche?: string; page?: number; limite?: number } = {}): Observable<CatalogueDocumentsResponse> {
    let params = new HttpParams();
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    return this.http.get<CatalogueDocumentsResponse>(this.apiUrl, { params });
  }

  /** `observe:'events'` + `reportProgress:true` : progression réelle rapportée par le
   *  navigateur pendant l'upload (pas simulée) — le composant appelant filtre sur
   *  `HttpEventType.UploadProgress`/`Response`. */
  create(
    data: DocumentCatalogueForm,
    image?: File | null,
    fichier?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): Observable<HttpEvent<{ message: string; document: CatalogueDocument }>> {
    const formData = this.versFormData(data, image, fichier, images, imagesExistantes);
    return this.http.post<{ message: string; document: CatalogueDocument }>(this.apiUrl, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  update(
    id: string,
    data: DocumentCatalogueForm,
    image?: File | null,
    fichier?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): Observable<HttpEvent<{ message: string; document: CatalogueDocument }>> {
    const formData = this.versFormData(data, image, fichier, images, imagesExistantes);
    return this.http.put<{ message: string; document: CatalogueDocument }>(`${this.apiUrl}/${id}`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  private versFormData(
    data: DocumentCatalogueForm,
    image?: File | null,
    fichier?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): FormData {
    const formData = new FormData();
    formData.append('titre', data.titre);
    formData.append('description', data.description);
    formData.append('categorie', data.categorie);
    formData.append('sousCategorie', data.sousCategorie);
    formData.append('type', data.type);
    formData.append('prix', String(data.prix));
    formData.append('gratuit', String(data.gratuit));
    formData.append('auteur', data.auteur || '');
    formData.append('faculte', data.faculte || '');
    formData.append('matiereEnseignee', data.matiereEnseignee || '');
    formData.append('semestre', data.semestre || '');
    if (data.actif !== undefined) formData.append('actif', String(data.actif));
    if (image) formData.append('image', image);
    if (fichier) formData.append('fichier', fichier);
    if (imagesExistantes) formData.append('imagesExistantes', JSON.stringify(imagesExistantes));
    (images || []).forEach(f => formData.append('images', f));
    return formData;
  }
}
