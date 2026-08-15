import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TypeCategorie = 'documents' | 'fournitures';

export interface Categorie {
  _id: string;
  nom: string;
  description: string;
  icone: string;
  couleur: string;
  image: string;
  type: TypeCategorie;
  ordre: number;
  actif: boolean;
  createdAt: string;
}

export interface CategorieForm {
  nom: string;
  description: string;
  icone: string;
  couleur: string;
  type: TypeCategorie;
}

@Injectable({ providedIn: 'root' })
export class AdminCategoriesService {
  private readonly apiUrl = `${environment.apiUrl}/admin/categories`;

  constructor(private http: HttpClient) {}

  list(options: { recherche?: string; type?: TypeCategorie } = {}): Observable<{ categories: Categorie[] }> {
    let params = new HttpParams();
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.type) params = params.set('type', options.type);
    return this.http.get<{ categories: Categorie[] }>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<Categorie> {
    return this.http.get<Categorie>(`${this.apiUrl}/${id}`);
  }

  create(data: CategorieForm, image?: File | null): Observable<{ message: string; categorie: Categorie }> {
    return this.http.post<{ message: string; categorie: Categorie }>(this.apiUrl, this.versFormData(data, image));
  }

  update(
    id: string,
    data: CategorieForm & { actif?: boolean },
    image?: File | null
  ): Observable<{ message: string; categorie: Categorie }> {
    return this.http.put<{ message: string; categorie: Categorie }>(`${this.apiUrl}/${id}`, this.versFormData(data, image));
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  reorder(ids: string[]): Observable<{ message: string; categories: Categorie[] }> {
    return this.http.put<{ message: string; categories: Categorie[] }>(`${environment.apiUrl}/admin/categories-reorder`, { ids });
  }

  private versFormData(data: CategorieForm & { actif?: boolean }, image?: File | null): FormData {
    const formData = new FormData();
    formData.append('nom', data.nom);
    formData.append('description', data.description || '');
    formData.append('icone', data.icone || '');
    formData.append('couleur', data.couleur || '');
    formData.append('type', data.type);
    if (data.actif !== undefined) formData.append('actif', String(data.actif));
    if (image) formData.append('image', image);
    return formData;
  }
}
