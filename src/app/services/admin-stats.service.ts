import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminOrder } from './admin-orders.service';
import { TypeActivite } from './user.service';

export interface AdminStats {
  totalUtilisateurs: number;
  totalCommandes: number;
  commandesEnAttente: number;
  commandesTerminees: number;
  ticketsOuverts: number;
  revenuTotal: number;
  clientsActifs: number;
  nouveauxClients30j: number;
  revenuMois: number;
  documentsVendus: number;
  fournituresVendues: number;
  parStatut: Record<string, number>;
}

export interface AdminUtilisateurRecent {
  _id: string;
  nom: string;
  prenom: string;
  email: string;
  photo?: string;
  actif: boolean;
  createdAt: string;
}

export interface ProduitVendu {
  titre: string;
  estDocument: boolean;
  quantite: number;
}

export interface SerieCommandesPoint {
  date: string;
  commandes: number;
  revenu: number;
}

export interface SerieUtilisateursPoint {
  date: string;
  count: number;
}

export interface AdminDashboardData {
  stats: AdminStats;
  dernieresCommandes: AdminOrder[];
  derniersUtilisateurs: AdminUtilisateurRecent[];
  produitsPlusVendus: ProduitVendu[];
  serieCommandes: SerieCommandesPoint[];
  serieUtilisateurs: SerieUtilisateursPoint[];
}

export interface AdminActiviteItem {
  _id: string;
  type: TypeActivite;
  description: string;
  createdAt: string;
  user?: { _id: string; nom: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<AdminDashboardData> {
    return this.http.get<AdminDashboardData>(`${this.apiUrl}/stats`);
  }

  getActivites(): Observable<AdminActiviteItem[]> {
    return this.http.get<AdminActiviteItem[]>(`${this.apiUrl}/activites`);
  }
}
