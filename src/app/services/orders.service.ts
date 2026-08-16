import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrderItem {
  titre: string;
  prix: number;
  quantite: number;
  image: string;
  /** Renseigné pour un document numérique : déclenche la création automatique de l'accès dans Mes Documents. */
  estDocument?: boolean;
  produitId?: number;
  categorie?: string;
  type?: string;
  auteur?: string;
  /** Couleur/format choisi pour une fourniture scolaire (voir CartService/PanierItem.variante). */
  variante?: string;
}

export interface InviteCommande {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
}

export interface HistoriqueStatut {
  statut: string;
  date: string;
}

export interface Order {
  _id: string;
  numero: string;
  items: OrderItem[];
  total: number;
  statut: string;
  paiement: string;
  referencePaiement?: string;
  adresseLivraison: string;
  createdAt: string;
  updatedAt?: string;
  historique?: HistoriqueStatut[];
  commentaire?: string;
  /** Renseigné uniquement pour une commande passée sans compte (voir orders.controller.js#create). */
  invite?: InviteCommande;
}

export interface OrdersResponse {
  commandes: Order[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly apiUrl = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  list(options: { statut?: string; recherche?: string; page?: number; limite?: number } = {}): Observable<OrdersResponse> {
    let params = new HttpParams();
    if (options.statut) params = params.set('statut', options.statut);
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    return this.http.get<OrdersResponse>(this.apiUrl, { params });
  }

  create(payload: {
    items: OrderItem[];
    total: number;
    paiement: string;
    adresseLivraison: string;
    /** Valeurs structurées (en plus d'adresseLivraison, qui reste le texte affiché) — utilisées
     *  côté caisse pour la création de colis Best Delivery, voir commande.component.ts. */
    gouvernorat?: string;
    delegation?: string;
    commentaire?: string;
    /** Achat sans compte : coordonnées + e-mail obligatoires (voir orders.controller.js#create). */
    invite?: InviteCommande;
  }): Observable<{ message: string; commande: Order }> {
    return this.http.post<{ message: string; commande: Order }>(this.apiUrl, payload);
  }

  getOne(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  cancel(id: string): Observable<{ message: string; commande: Order }> {
    return this.http.put<{ message: string; commande: Order }>(`${this.apiUrl}/${id}/annuler`, {});
  }

  telechargerFacture(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/facture`, { responseType: 'blob' });
  }
}
