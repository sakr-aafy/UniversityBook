import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SousCategorie {
  _id: string;
  nom: string;
  categorie: string;
  actif: boolean;
  ordre: number;
  createdAt: string;
}

export interface SousCategorieForm {
  nom: string;
  categorie: string;
}

@Injectable({ providedIn: 'root' })
export class AdminSousCategoriesService {
  private readonly apiUrl = `${environment.apiUrl}/admin/sous-categories`;

  constructor(private http: HttpClient) {}

  list(options: { categorie?: string } = {}): Observable<{ sousCategories: SousCategorie[] }> {
    let params = new HttpParams();
    if (options.categorie) params = params.set('categorie', options.categorie);
    return this.http.get<{ sousCategories: SousCategorie[] }>(this.apiUrl, { params });
  }

  create(data: SousCategorieForm): Observable<{ message: string; sousCategorie: SousCategorie }> {
    return this.http.post<{ message: string; sousCategorie: SousCategorie }>(this.apiUrl, data);
  }

  update(id: string, data: SousCategorieForm & { actif?: boolean }): Observable<{ message: string; sousCategorie: SousCategorie }> {
    return this.http.put<{ message: string; sousCategorie: SousCategorie }>(`${this.apiUrl}/${id}`, data);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
