import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategorieCaisseDto {
  nom: string;
  sousCategories: string[];
}

/**
 * Lit la Catégorie/Sous-Catégorie du formulaire produit caisse (champs "Catégorie"/"Sous-Catégorie"
 * en haut du formulaire, distincts de la case "Ajouter sur Site Internet" — voir
 * CategoriesSiteService) via l'endpoint public GET /api/catalogue/categories-caisse. Contrairement
 * à caisse/categories-api.service.ts (liste complète CategorieCaisse), ne renvoie que les
 * catégories/sous-catégories réellement utilisées par des produits caisse avec
 * `ajouterSurSite: true` — jamais de catégorie sans aucun produit visible sur le site derrière —
 * pour le mega-menu "Fournitures scolaires" du header.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesCaisseService {
  constructor(private http: HttpClient) {}

  list(): Observable<{ categories: CategorieCaisseDto[] }> {
    return this.http.get<{ categories: CategorieCaisseDto[] }>(`${environment.apiUrl}/catalogue/categories-caisse`);
  }
}
