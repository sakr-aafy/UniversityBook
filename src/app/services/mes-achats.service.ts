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
  totalHT: number;
  tva: number;
  tvaPct: number;
  totalTTC: number;
  modePaiement: string;
  pointsGagnes: number;
  statut: 'valide' | 'annule' | 'rembourse';
  /** true si ce ticket est déjà rattaché à une facture (un ticket = une facture au plus). */
  dejaFacture: boolean;
  numFacture?: string;
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
  modePaiement: string;
  produits: LigneFacture[];
}

export type ModePaiementFacture = 'points' | 'd17' | 'carte';

export interface EntrepriseInfos {
  nomEntreprise: string;
  logo: string;
  adresse: string;
  telephone: string;
  matriculeFiscal: string;
  nomSignataire: string;
  signature: string;
  cachet: string;
  timbreFiscal: number;
}

export interface CreditEntry {
  date: string;
  type: 'credit' | 'paiement' | 'conversion';
  montant: number;
  note: string;
  soldeApres: number;
}

export interface ConversionEntry {
  date: string;
  heure: string;
  points: number;
  montantCredit: number;
}

export interface CarteFidelite {
  titulaire: string;
  numeroCarte: string;
  codeBarres: string;
  statut: 'actif' | 'inactif' | 'bloque';
  tel: string;
  email: string;
  adresse: string;
  cin: string;
  matriculeFiscal: string;
  points: number;
  tauxPoint: number;
  pointsValeurDT: number;
  credit: number;
  creditHistory: CreditEntry[];
  conversions: ConversionEntry[];
  depuis: string;
  dernierPassage: string;
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

  maCarteFidelite(): Observable<{ carte: CarteFidelite | null }> {
    return this.http.get<{ carte: CarteFidelite | null }>(`${this.apiUrl}/fidelite`);
  }

  /** Coordonnées + signature / cachet de l'entreprise (Paramètres caisse) pour l'impression des factures. */
  entreprise(): Observable<EntrepriseInfos> {
    return this.http.get<EntrepriseInfos>(`${this.apiUrl}/entreprise`);
  }

  /** Génère une facture à partir d'une sélection de tickets (chacun facturable une seule fois). */
  creerFacture(ticketIds: string[]): Observable<{ message: string; facture: Facture }> {
    return this.http.post<{ message: string; facture: Facture }>(`${this.apiUrl}/factures`, { ticketIds });
  }

  /** Règle une facture émise (points fidélité / D17 / carte bancaire). Le timbre fiscal est
   *  ajouté au règlement. */
  payerFacture(id: string, modePaiement: ModePaiementFacture): Observable<{
    message: string; facture: Facture; pointsRestants?: number; pointsUtilises?: number;
  }> {
    return this.http.put<{ message: string; facture: Facture; pointsRestants?: number; pointsUtilises?: number }>(
      `${this.apiUrl}/factures/${id}/payer`, { modePaiement }
    );
  }
}
