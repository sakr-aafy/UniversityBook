import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  photo?: string;
  role: string;
  actif: boolean;
  supprime: boolean;
  derniereConnexion: string | null;
  dateInscription: string;
  totalCommandes?: number;
  totalAchats?: number;
}

export interface AdminUserDetail extends AdminUser {
  totalCommandes: number;
  totalAchats: number;
}

export interface AdminUsersResponse {
  utilisateurs: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserUpdatePayload {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  telephoneSecondaire?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly apiUrl = `${environment.apiUrl}/admin/utilisateurs`;

  constructor(private http: HttpClient) {}

  list(options: { recherche?: string; page?: number; limite?: number; avecSupprimes?: boolean } = {}): Observable<AdminUsersResponse> {
    let params = new HttpParams();
    if (options.recherche) params = params.set('recherche', options.recherche);
    if (options.page) params = params.set('page', options.page);
    if (options.limite) params = params.set('limite', options.limite);
    if (options.avecSupprimes) params = params.set('avecSupprimes', '1');
    return this.http.get<AdminUsersResponse>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`${this.apiUrl}/${id}`);
  }

  update(id: string, payload: AdminUserUpdatePayload): Observable<{ message: string; user: AdminUser }> {
    return this.http.put<{ message: string; user: AdminUser }>(`${this.apiUrl}/${id}`, payload);
  }

  toggleActive(id: string, actif: boolean): Observable<{ message: string; user: AdminUser }> {
    return this.http.put<{ message: string; user: AdminUser }>(`${this.apiUrl}/${id}/statut`, { actif });
  }

  remove(id: string): Observable<{ message: string; user: AdminUser }> {
    return this.http.delete<{ message: string; user: AdminUser }>(`${this.apiUrl}/${id}`);
  }
}
