import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AdminOrdersService, AdminOrder } from '../../services/admin-orders.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

interface ColonneKanban {
  commandes: AdminOrder[];
  total: number;
  limite: number;
  chargement: boolean;
}

interface StatutInfo {
  label: string;
  couleur: string;
  fond: string;
  icone: string;
}

const STATUTS_INFO: Record<string, StatutInfo> = {
  'En attente':     { label: 'En attente',     couleur: '#B45309', fond: '#FFFBEB', icone: 'fa-clock' },
  'Confirmée':      { label: 'Confirmée',      couleur: '#2563EB', fond: '#EFF6FF', icone: 'fa-circle-check' },
  'En préparation': { label: 'En préparation', couleur: '#7C3AED', fond: '#F5F3FF', icone: 'fa-box-open' },
  'Expédiée':       { label: 'Expédiée',       couleur: '#0891B2', fond: '#ECFEFF', icone: 'fa-truck' },
  'Terminée':       { label: 'Livrée',         couleur: '#16A34A', fond: '#ECFDF5', icone: 'fa-truck-fast' },
  'Annulée':        { label: 'Annulée',        couleur: '#DC2626', fond: '#FEF2F2', icone: 'fa-circle-xmark' },
  'Remboursée':     { label: 'Remboursée',     couleur: '#EA580C', fond: '#FFF7ED', icone: 'fa-rotate-left' }
};

const ORDRE_COLONNES = ['En attente', 'Confirmée', 'En préparation', 'Expédiée', 'Terminée', 'Annulée', 'Remboursée'];

/** Transitions autorisées depuis chaque statut (boutons affichés sur chaque carte). */
const TRANSITIONS: Record<string, { statut: string; label: string; icone: string }[]> = {
  'En attente':     [{ statut: 'Confirmée', label: 'Confirmer', icone: 'fa-circle-check' }, { statut: 'Annulée', label: 'Annuler', icone: 'fa-xmark' }],
  'Confirmée':      [{ statut: 'En préparation', label: 'Préparation', icone: 'fa-box-open' }, { statut: 'Annulée', label: 'Annuler', icone: 'fa-xmark' }],
  'En préparation': [{ statut: 'Expédiée', label: 'Expédier', icone: 'fa-truck' }, { statut: 'Annulée', label: 'Annuler', icone: 'fa-xmark' }],
  'Expédiée':       [{ statut: 'Terminée', label: 'Livrer', icone: 'fa-truck-fast' }],
  'Terminée':       [{ statut: 'Remboursée', label: 'Rembourser', icone: 'fa-rotate-left' }],
  'Annulée':        [],
  'Remboursée':     []
};

@Component({
  selector: 'app-admin-commandes',
  templateUrl: './commandes.component.html',
  styleUrls: ['./commandes.component.css']
})
export class CommandesComponent implements OnInit {
  readonly ordreColonnes = ORDRE_COLONNES;
  colonnes: Record<string, ColonneKanban> = {};
  chargementInitial: boolean = true;
  erreur: string = '';
  succes: string = '';

  recherche: string = '';

  commandeSelectionnee: AdminOrder | null = null;
  chargementDetail: boolean = false;
  actionFactureEnCours: boolean = false;

  constructor(
    private adminOrdersService: AdminOrdersService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    ORDRE_COLONNES.forEach(s => (this.colonnes[s] = { commandes: [], total: 0, limite: 8, chargement: true }));
    this.charger();
  }

  statutInfo(statut: string): StatutInfo {
    return STATUTS_INFO[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  transitions(statut: string): { statut: string; label: string; icone: string }[] {
    return TRANSITIONS[statut] || [];
  }

  /** Nom du client, qu'il s'agisse d'un compte réel ou d'un achat sans compte (invité). */
  nomClient(commande: AdminOrder): string {
    if (commande.user) return commande.user.nom;
    if (commande.invite) return `${commande.invite.prenom} ${commande.invite.nom}`.trim() || 'Invité';
    return 'Invité';
  }

  emailClient(commande: AdminOrder): string {
    return commande.user?.email || commande.invite?.email || '—';
  }

  nombreArticles(commande: AdminOrder): number {
    return commande.items.reduce((acc, i) => acc + i.quantite, 0);
  }

  charger(): void {
    this.erreur = '';
    const appels = Object.fromEntries(
      ORDRE_COLONNES.map(s => [
        s,
        this.adminOrdersService.list({ statut: s, recherche: this.recherche, limite: this.colonnes[s]?.limite || 8 })
      ])
    );

    forkJoin(appels).subscribe({
      next: (res: any) => {
        ORDRE_COLONNES.forEach(s => {
          this.colonnes[s] = {
            commandes: res[s].commandes,
            total: res[s].total,
            limite: this.colonnes[s]?.limite || 8,
            chargement: false
          };
        });
        this.chargementInitial = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les commandes.';
        this.chargementInitial = false;
      }
    });
  }

  rechercher(): void {
    ORDRE_COLONNES.forEach(s => (this.colonnes[s].limite = 8));
    this.charger();
  }

  chargerPlus(statut: string): void {
    this.colonnes[statut].limite += 8;
    this.colonnes[statut].chargement = true;
    this.adminOrdersService.list({ statut, recherche: this.recherche, limite: this.colonnes[statut].limite }).subscribe({
      next: res => {
        this.colonnes[statut] = { ...this.colonnes[statut], commandes: res.commandes, total: res.total, chargement: false };
      },
      error: () => {
        this.colonnes[statut].chargement = false;
      }
    });
  }

  changerStatut(commande: AdminOrder, statut: string): void {
    this.erreur = '';
    this.adminOrdersService.updateStatut(commande._id, statut).subscribe({
      next: res => {
        const ancienneColonne = this.colonnes[commande.statut];
        ancienneColonne.commandes = ancienneColonne.commandes.filter(c => c._id !== commande._id);
        ancienneColonne.total = Math.max(0, ancienneColonne.total - 1);

        const commandeMaj = res.commande;
        this.colonnes[statut].commandes.unshift(commandeMaj);
        this.colonnes[statut].total++;

        if (this.commandeSelectionnee?._id === commande._id) this.commandeSelectionnee = commandeMaj;
      },
      error: () => (this.erreur = 'Erreur lors de la mise à jour du statut.')
    });
  }

  /** Suppression définitive (admin) — retire la commande de sa colonne, ferme le détail si
   *  c'est celle affichée. Le Dashboard/KPI se mettent à jour au prochain chargement (calculs
   *  en direct, sans cache — pas de push temps réel, même limite que pour la Boutique). */
  async supprimer(commande: AdminOrder): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Confirmation de suppression',
      message: `Supprimer la commande ${commande.numero} ? Cette action est irréversible et supprimera définitivement son historique.`,
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.erreur = '';
    this.adminOrdersService.remove(commande._id).subscribe({
      next: () => {
        const colonne = this.colonnes[commande.statut];
        if (colonne) {
          colonne.commandes = colonne.commandes.filter(c => c._id !== commande._id);
          colonne.total = Math.max(0, colonne.total - 1);
        }
        if (this.commandeSelectionnee?._id === commande._id) this.fermerDetail();
        this.succes = `Commande ${commande.numero} supprimée avec succès.`;
        setTimeout(() => (this.succes = ''), 5000);
      },
      error: () => (this.erreur = 'Erreur lors de la suppression de la commande.')
    });
  }

  voirDetail(commande: AdminOrder): void {
    this.chargementDetail = true;
    this.commandeSelectionnee = commande;
    this.adminOrdersService.getOne(commande._id).subscribe({
      next: detail => {
        this.commandeSelectionnee = detail;
        this.chargementDetail = false;
      },
      error: () => {
        this.chargementDetail = false;
      }
    });
  }

  fermerDetail(): void {
    this.commandeSelectionnee = null;
  }

  telechargerFacture(commande: AdminOrder): void {
    this.actionFactureEnCours = true;
    this.adminOrdersService.telechargerFacture(commande._id).subscribe({
      next: blob => {
        this.actionFactureEnCours = false;
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `Facture-${commande.numero}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.actionFactureEnCours = false;
        this.erreur = 'Impossible de télécharger la facture.';
      }
    });
  }

  envoyerFacture(commande: AdminOrder): void {
    this.actionFactureEnCours = true;
    this.succes = '';
    this.adminOrdersService.envoyerFacture(commande._id).subscribe({
      next: () => {
        this.actionFactureEnCours = false;
        this.succes = `Facture envoyée à ${this.emailClient(commande)}.`;
        setTimeout(() => (this.succes = ''), 5000);
      },
      error: err => {
        this.actionFactureEnCours = false;
        this.erreur = err.error?.message || "Erreur lors de l'envoi de la facture par e-mail.";
      }
    });
  }

  imprimerFacture(commande: AdminOrder): void {
    const fenetre = window.open('', '_blank', 'width=800,height=1000');
    if (!fenetre) return;

    const lignes = commande.items
      .map(
        item => `
          <tr>
            <td>${item.titre}</td>
            <td style="text-align:center;">${item.quantite}</td>
            <td style="text-align:right;">${item.prix.toFixed(3)} DT</td>
            <td style="text-align:right;">${(item.prix * item.quantite).toFixed(3)} DT</td>
          </tr>`
      )
      .join('');

    fenetre.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Facture ${commande.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1B2430; padding: 40px; }
          .en-tete { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .en-tete h1 { margin: 0; color: #7E1F2E; }
          .en-tete p { margin: 2px 0; font-size: 13px; color: #6B7480; }
          .facture-titre { text-align: right; }
          .facture-titre h2 { margin: 0; }
          .bloc { margin-bottom: 24px; }
          .bloc h3 { font-size: 12px; text-transform: uppercase; color: #6B7480; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 10px; border-bottom: 1px solid #ECEDEF; font-size: 14px; }
          th { text-align: left; background: #F7F8FA; }
          .total { text-align: right; margin-top: 16px; font-size: 18px; font-weight: bold; color: #7E1F2E; }
          .pied { margin-top: 48px; font-size: 12px; color: #9AA0A8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="en-tete">
          <div>
            <h1>University Book</h1>
            <p>contact@universitybook.tn</p>
            <p>+216 21 717 222</p>
          </div>
          <div class="facture-titre">
            <h2>Facture</h2>
            <p>N° ${commande.numero}</p>
            <p>Date : ${new Date(commande.createdAt).toLocaleDateString('fr-FR')}</p>
            <p>Statut : ${commande.statut}</p>
          </div>
        </div>

        <div class="bloc">
          <h3>Client</h3>
          <p>${this.nomClient(commande)}</p>
          <p>${this.emailClient(commande)}</p>
        </div>

        <div class="bloc">
          <h3>Adresse de livraison</h3>
          <p>${commande.adresseLivraison || '—'}</p>
        </div>

        <div class="bloc">
          <h3>Mode de paiement</h3>
          <p>${commande.paiement || '—'}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th style="text-align:center;">Qté</th>
              <th style="text-align:right;">Prix</th>
              <th style="text-align:right;">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            ${lignes}
          </tbody>
        </table>

        <div class="total">Total : ${commande.total.toFixed(3)} DT</div>

        <div class="pied">Merci pour votre confiance — University Book</div>
      </body>
      </html>
    `);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();
  }

  trackById(_index: number, item: AdminOrder): string {
    return item._id;
  }
}
