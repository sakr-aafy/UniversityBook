import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SousCategorieSiteDto {
  nom: string;
  sousSousCategories: string[];
}

export interface CategorieSiteDto {
  id: string;
  nom: string;
  sousCategories: SousCategorieSiteDto[];
}

/**
 * Lit la taxonomie "sur site" (Catégorie/Sous-Catégorie/Sous-Sous-Catégorie sur site) gérée côté
 * caisse (case "Ajouter sur Site Internet" du formulaire produit) via l'endpoint public
 * GET /api/catalogue/categories-site — même donnée que caisse/categories-site-api.service.ts,
 * exposée ici sans authentification pour alimenter le mega-menu du header.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesSiteService {
  constructor(private http: HttpClient) {}

  list(): Observable<{ categories: CategorieSiteDto[] }> {
    return this.http.get<{ categories: CategorieSiteDto[] }>(`${environment.apiUrl}/catalogue/categories-site`);
  }
}
