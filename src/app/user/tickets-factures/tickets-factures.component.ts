import { Component, OnInit } from '@angular/core';
import { MesAchatsService, Ticket, Facture } from '../../services/mes-achats.service';

type Onglet = 'tickets' | 'factures';

interface StatutTicketInfo { label: string; couleur: string; fond: string; icone: string; }
interface StatutFactureInfo { label: string; couleur: string; fond: string; icone: string; }

const STATUTS_TICKET: Record<string, StatutTicketInfo> = {
  valide:    { label: 'Valide',     couleur: '#16A34A', fond: '#ECFDF5', icone: 'fa-circle-check' },
  annule:    { label: 'Annulé',     couleur: '#DC2626', fond: '#FEF2F2', icone: 'fa-circle-xmark' },
  rembourse: { label: 'Remboursé',  couleur: '#EA580C', fond: '#FFF7ED', icone: 'fa-rotate-left' }
};

const STATUTS_FACTURE: Record<string, StatutFactureInfo> = {
  emise:   { label: 'Émise',   couleur: '#B45309', fond: '#FFFBEB', icone: 'fa-clock' },
  payee:   { label: 'Payée',   couleur: '#16A34A', fond: '#ECFDF5', icone: 'fa-circle-check' },
  annulee: { label: 'Annulée', couleur: '#DC2626', fond: '#FEF2F2', icone: 'fa-circle-xmark' }
};

@Component({
  selector: 'app-tickets-factures',
  templateUrl: './tickets-factures.component.html',
  styleUrls: ['./tickets-factures.component.css']
})
export class TicketsFacturesComponent implements OnInit {
  ongletActif: Onglet = 'tickets';

  tickets: Ticket[] = [];
  factures: Facture[] = [];
  chargement: boolean = true;
  erreur: string = '';

  ticketSelectionne: Ticket | null = null;
  factureSelectionnee: Facture | null = null;

  constructor(private mesAchatsService: MesAchatsService) {}

  ngOnInit(): void {
    this.charger();
  }

  changerOnglet(onglet: Onglet): void {
    this.ongletActif = onglet;
  }

  private charger(): void {
    this.chargement = true;
    this.erreur = '';
    this.mesAchatsService.mesTickets().subscribe({
      next: res => {
        this.tickets = res.tickets;
        this.chargerFactures();
      },
      error: () => {
        this.erreur = 'Impossible de charger vos achats en magasin pour le moment.';
        this.chargement = false;
      }
    });
  }

  private chargerFactures(): void {
    this.mesAchatsService.mesFactures().subscribe({
      next: res => {
        this.factures = res.factures;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger vos achats en magasin pour le moment.';
        this.chargement = false;
      }
    });
  }

  statutTicketInfo(statut: string): StatutTicketInfo {
    return STATUTS_TICKET[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  statutFactureInfo(statut: string): StatutFactureInfo {
    return STATUTS_FACTURE[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  nombreArticlesTicket(t: Ticket): number {
    return t.lignes.reduce((acc, l) => acc + l.qte, 0);
  }

  voirTicket(t: Ticket): void { this.ticketSelectionne = t; }
  fermerTicket(): void { this.ticketSelectionne = null; }

  voirFacture(f: Facture): void { this.factureSelectionnee = f; }
  fermerFacture(): void { this.factureSelectionnee = null; }

  imprimer(): void { window.print(); }

  trackByTicket(_index: number, item: Ticket): string { return item.id; }
  trackByFacture(_index: number, item: Facture): string { return item.id; }
}
