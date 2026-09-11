import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderItem, InviteCommande } from './orders.service';

export interface Payment {
  id: string;
  reference: string;
  date: string;
  montant: number;
  modePaiement: string;
  statut: string;
}

/** Statut d'une commande Konnect vu depuis la page de retour (voir payments.controller.js#statutKonnect). */
export interface StatutKonnect {
  numero: string;
  statut: string;
  /** '' = paiement à la livraison (n'a pas de notion de paiement en ligne) ; sinon le cycle de
   *  vie Konnect : 'en_attente' (webhook pas encore reçu/traité), 'reussi', 'echoue'. */
  statutPaiementEnLigne: '' | 'en_attente' | 'reussi' | 'echoue';
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly apiUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  list(): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.apiUrl);
  }

  /**
   * Démarre un paiement en ligne Konnect — même payload que OrdersService.create() (voir
   * orders.controller.js#construireCommande, réutilisé par les deux). Renvoie l'URL de la page
   * de paiement hébergée Konnect, vers laquelle il faut rediriger le navigateur en entier
   * (`window.location.href`, jamais un simple lien interne Angular).
   */
  initierKonnect(payload: {
    items: OrderItem[];
    total: number;
    paiement: string;
    adresseLivraison: string;
    gouvernorat?: string;
    delegation?: string;
    commentaire?: string;
    invite?: InviteCommande;
  }): Observable<{ message: string; payUrl: string; numero: string; jetonSuivi: string }> {
    return this.http.post<{ message: string; payUrl: string; numero: string; jetonSuivi: string }>(
      `${this.apiUrl}/konnect/initier`, payload
    );
  }

  /** Page de retour Konnect : statut de la commande, sans authentification (gardé par le couple
   *  numéro + jeton — voir payments.controller.js#statutKonnect, peut être un client invité). */
  statutKonnect(numero: string, jeton: string): Observable<StatutKonnect> {
    const params = new HttpParams().set('numero', numero).set('jeton', jeton);
    return this.http.get<StatutKonnect>(`${this.apiUrl}/konnect/statut`, { params });
  }
}
