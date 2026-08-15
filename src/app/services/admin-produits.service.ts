import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VarianteCouleurForm {
  nom: string;
  hex: string;
  stock: number;
}

export interface VarianteFormatForm {
  nom: string;
  prixDelta: number;
  stock: number;
}

export interface CatalogueProduit {
  _id: string;
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
  prix: number;
  stock: number;
  image: string;
  images: string[];
  actif: boolean;
  sku: string;
  marque: string;
  codeBarres: string;
  ancienPrix?: number;
  badge: string;
  nouveaute: boolean;
  populaire: boolean;
  couleurs: VarianteCouleurForm[];
  formats: VarianteFormatForm[];
  createdAt: string;
}

export interface CatalogueProduitsResponse {
  produits: CatalogueProduit[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ProduitForm {
  titre: string;
  description: string;
  categorie: string;
  sousCategorie: string;
  type: string;
  prix: number;
  stock: number;
  sku: string;
  marque: string;
  codeBarres: string;
  ancienPrix: number | null;
  badge: string;
  nouveaute: boolean;
  populaire: boolean;
  couleurs: VarianteCouleurForm[];
  formats: VarianteFormatForm[];
}

@Injectable({ providedIn: 'root' })
export class AdminProduitsService {
  private readonly apiUrl = `${environment.apiUrl}/admin/produits`;

  constructor(private http: HttpClient) {}

  list(options: { recherche?: string; page?: number; limite?: number } = {}): Observable<CatalogueProduitsResponse> {
    let params = new HttpParams();
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    return this.http.get<CatalogueProduitsResponse>(this.apiUrl, { params });
  }

  /** `observe:'events'` + `reportProgress:true` : progression réelle rapportée par le
   *  navigateur pendant l'upload (pas simulée). */
  create(
    data: ProduitForm,
    image?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): Observable<HttpEvent<{ message: string; produit: CatalogueProduit }>> {
    const formData = this.versFormData(data, image, images, imagesExistantes);
    return this.http.post<{ message: string; produit: CatalogueProduit }>(this.apiUrl, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  update(
    id: string,
    data: ProduitForm,
    image?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): Observable<HttpEvent<{ message: string; produit: CatalogueProduit }>> {
    const formData = this.versFormData(data, image, images, imagesExistantes);
    return this.http.put<{ message: string; produit: CatalogueProduit }>(`${this.apiUrl}/${id}`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  private versFormData(
    data: ProduitForm,
    image?: File | null,
    images?: File[],
    imagesExistantes?: string[]
  ): FormData {
    const formData = new FormData();
    formData.append('titre', data.titre);
    formData.append('description', data.description);
    formData.append('categorie', data.categorie);
    formData.append('sousCategorie', data.sousCategorie || '');
    formData.append('type', data.type);
    formData.append('prix', String(data.prix));
    formData.append('stock', String(data.stock));
    formData.append('sku', data.sku || '');
    formData.append('marque', data.marque || '');
    formData.append('codeBarres', data.codeBarres || '');
    if (data.ancienPrix !== null && data.ancienPrix !== undefined) {
      formData.append('ancienPrix', String(data.ancienPrix));
    }
    formData.append('badge', data.badge || '');
    formData.append('nouveaute', String(data.nouveaute));
    formData.append('populaire', String(data.populaire));
    formData.append('couleurs', JSON.stringify(data.couleurs || []));
    formData.append('formats', JSON.stringify(data.formats || []));
    if (image) formData.append('image', image);
    if (imagesExistantes) formData.append('imagesExistantes', JSON.stringify(imagesExistantes));
    (images || []).forEach(f => formData.append('images', f));
    return formData;
  }
}
