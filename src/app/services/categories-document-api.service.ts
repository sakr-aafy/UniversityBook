import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategorieDocumentDto {
  id: string;
  nom: string;
  sousCategories: string[];
}

@Injectable({ providedIn: 'root' })
export class CategoriesDocumentApiService {
  private readonly base = `${environment.apiUrl}/caisse/categories`;

  constructor(private http: HttpClient) {}

  list(): Observable<{ categories: CategorieDocumentDto[] }> {
    return this.http.get<{ categories: CategorieDocumentDto[] }>(this.base);
  }

  create(nom: string): Observable<{ message: string; categorie: CategorieDocumentDto }> {
    return this.http.post<{ message: string; categorie: CategorieDocumentDto }>(this.base, { nom });
  }

  ajouterSousCategorie(categorieId: string, nom: string): Observable<{ message: string; categorie: CategorieDocumentDto }> {
    return this.http.post<{ message: string; categorie: CategorieDocumentDto }>(
      `${this.base}/${categorieId}/sous-categories`,
      { nom }
    );
  }
}
