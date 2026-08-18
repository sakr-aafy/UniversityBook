import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LigneTicket {
  designation: string;
  ref: string;
  qte: number;
  prixUnitaire: number;
  remisePct: number;
  totalLigne: number;
}

export interface Ticket {
  id: string;
  numero: number;
  codeBarre: string;
  lignes: LigneTicket[];
  sousTotal: number;
  remiseGlobale: number;
  remiseFidelite: number;
  totalTTC: number;
  modePaiement: string;
  pointsGagnes: number;
  statut: 'valide' | 'annule' | 'rembourse';
  date: string;
}

export interface LigneFacture {
  ref: string;
  designation: string;
  qty: number;
  prixHT: number;
  tva: number;
  remise: number;
  totalTTC: number;
}

export interface Facture {
  id: string;
  numFacture: string;
  numTicket: string;
  date: string;
  datePaiement: string;
  client: string;
  total: number;
  timbreFiscal: number;
  statut: 'emise' | 'payee' | 'annulee';
  produits: LigneFacture[];
}

/** Achats faits en magasin (caisse) — tickets de vente et factures — rattachés au compte site
 *  connecté par rapprochement email/téléphone avec sa fiche client caisse (voir
 *  mesAchatsCaisse.controller.js). Distinct de OrdersService, qui couvre les commandes du site. */
@Injectable({ providedIn: 'root' })
export class MesAchatsService {
  private readonly apiUrl = `${environment.apiUrl}/mes-achats`;

  constructor(private http: HttpClient) {}

  mesTickets(): Observable<{ tickets: Ticket[] }> {
    return this.http.get<{ tickets: Ticket[] }>(`${this.apiUrl}/tickets`);
  }

  mesFactures(): Observable<{ factures: Facture[] }> {
    return this.http.get<{ factures: Facture[] }>(`${this.apiUrl}/factures`);
  }
}
