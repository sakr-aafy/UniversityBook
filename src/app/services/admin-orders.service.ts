import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Order } from './orders.service';

export interface AdminOrder extends Order {
  // Optionnel : absent pour une commande passée sans compte (voir `invite` sur Order).
  user?: { _id: string; nom: string; email: string; telephone?: string };
}

export interface AdminOrdersResponse {
  commandes: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly apiUrl = `${environment.apiUrl}/admin/commandes`;

  constructor(private http: HttpClient) {}

  list(options: { statut?: string; recherche?: string; page?: number; limite?: number } = {}): Observable<AdminOrdersResponse> {
    let params = new HttpParams();
    if (options.statut) params = params.set('statut', options.statut);
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    return this.http.get<AdminOrdersResponse>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(`${this.apiUrl}/${id}`);
  }

  updateStatut(id: string, statut: string): Observable<{ message: string; commande: AdminOrder }> {
    return this.http.put<{ message: string; commande: AdminOrder }>(`${this.apiUrl}/${id}/statut`, { statut });
  }

  telechargerFacture(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/facture`, { responseType: 'blob' });
  }

  envoyerFacture(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/envoyer-facture`, {});
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
