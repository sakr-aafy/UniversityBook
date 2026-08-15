import { Component, OnInit } from '@angular/core';
import { PaymentsService, Payment } from '../../services/payments.service';
import { OrdersService, Order } from '../../services/orders.service';

interface StatutInfo { couleur: string; fond: string; }

const STATUTS_INFO: Record<string, StatutInfo> = {
  'En attente':     { couleur: '#B45309', fond: '#FFFBEB' },
  'Confirmée':      { couleur: '#2563EB', fond: '#EFF6FF' },
  'En préparation': { couleur: '#7C3AED', fond: '#F5F3FF' },
  'Terminée':       { couleur: '#16A34A', fond: '#ECFDF5' },
  'Annulée':        { couleur: '#DC2626', fond: '#FEF2F2' }
};

@Component({
  selector: 'app-paiements',
  templateUrl: './paiements.component.html',
  styleUrls: ['./paiements.component.css']
})
export class PaiementsComponent implements OnInit {
  paiements: Payment[] = [];
  chargement: boolean = true;
  erreur: string = '';

  factureCommande: Order | null = null;
  chargementFacture: boolean = false;

  constructor(private paymentsService: PaymentsService, private ordersService: OrdersService) {}

  ngOnInit(): void {
    this.paymentsService.list().subscribe({
      next: paiements => {
        this.paiements = paiements;
        this.chargement = false;
      },
      error: () => {
        this.erreur = "Impossible de charger l'historique des paiements.";
        this.chargement = false;
      }
    });
  }

  statutInfo(statut: string): StatutInfo {
    return STATUTS_INFO[statut] || { couleur: '#3C444E', fond: '#F0F1F4' };
  }

  iconeMethode(methode: string): string {
    return (methode || '').toLowerCase().includes('ligne') ? 'fa-credit-card' : 'fa-money-bill-wave';
  }

  voirFacture(paiement: Payment): void {
    this.chargementFacture = true;
    this.factureCommande = null;
    this.ordersService.getOne(paiement.id).subscribe({
      next: commande => {
        this.factureCommande = commande;
        this.chargementFacture = false;
      },
      error: () => {
        this.chargementFacture = false;
      }
    });
  }

  fermerFacture(): void {
    this.factureCommande = null;
  }

  imprimer(): void {
    window.print();
  }

  trackById(_index: number, item: Payment): string {
    return item.id;
  }
}
