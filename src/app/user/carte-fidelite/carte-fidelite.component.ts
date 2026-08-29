import { Component, OnInit } from '@angular/core';
import { MesAchatsService, CarteFidelite } from '../../services/mes-achats.service';

/**
 * Carte fidélité & crédit du compte connecté — extrait de l'ancien onglet « fidelite » de
 * tickets-factures.component (voir historique). Rattachée à la fiche client caisse par
 * rapprochement email/téléphone (mesAchatsCaisse.controller.js) : elle peut être absente.
 */
@Component({
  selector: 'app-carte-fidelite',
  templateUrl: './carte-fidelite.component.html',
  styleUrls: ['./carte-fidelite.component.css']
})
export class CarteFideliteComponent implements OnInit {
  carte: CarteFidelite | null = null;
  chargement: boolean = true;
  erreur: string = '';

  constructor(private mesAchatsService: MesAchatsService) {}

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.chargement = true;
    this.erreur = '';
    this.mesAchatsService.maCarteFidelite().subscribe({
      next: res => { this.carte = res.carte; this.chargement = false; },
      error: () => {
        this.carte = null;
        this.chargement = false;
        this.erreur = 'Impossible de charger votre carte fidélité pour le moment.';
      }
    });
  }

  get soldePointsPlusCredit(): number {
    if (!this.carte) return 0;
    return this.carte.pointsValeurDT + this.carte.credit;
  }

  libelleCredit(type: string): string {
    const m: Record<string, string> = {
      credit: 'Crédit ajouté', paiement: 'Paiement / déduction', conversion: 'Conversion de points'
    };
    return m[type] || type;
  }
}
