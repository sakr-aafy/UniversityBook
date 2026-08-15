import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService, Order, OrderItem, HistoriqueStatut } from '../../services/orders.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

interface StatutInfo {
  label: string;
  couleur: string;
  fond: string;
  icone: string;
}

const STATUTS_INFO: Record<string, StatutInfo> = {
  'En attente':     { label: 'En attente',    couleur: '#B45309', fond: '#FFFBEB', icone: 'fa-clock' },
  'Confirmée':      { label: 'Confirmée',     couleur: '#2563EB', fond: '#EFF6FF', icone: 'fa-circle-check' },
  'En préparation': { label: 'En préparation', couleur: '#7C3AED', fond: '#F5F3FF', icone: 'fa-box-open' },
  'Expédiée':       { label: 'Expédiée',      couleur: '#0891B2', fond: '#ECFEFF', icone: 'fa-truck' },
  'Terminée':       { label: 'Livrée',        couleur: '#16A34A', fond: '#ECFDF5', icone: 'fa-truck-fast' },
  'Annulée':        { label: 'Annulée',       couleur: '#DC2626', fond: '#FEF2F2', icone: 'fa-circle-xmark' },
  'Remboursée':     { label: 'Remboursée',    couleur: '#EA580C', fond: '#FFF7ED', icone: 'fa-rotate-left' }
};

/** Étapes affichées dans la barre de progression (annulation/remboursement sont des états à
 *  part, hors progression linéaire). */
const ETAPES_PROGRESSION = ['En attente', 'Confirmée', 'En préparation', 'Expédiée', 'Terminée'];

@Component({
  selector: 'app-commandes',
  templateUrl: './commandes.component.html',
  styleUrls: ['./commandes.component.css']
})
export class CommandesComponent implements OnInit {
  commandes: Order[] = [];
  chargement: boolean = true;
  erreur: string = '';
  succes: string = '';

  recherche: string = '';
  statutFiltre: string = '';
  page: number = 1;
  totalPages: number = 1;

  statuts: string[] = ['En attente', 'Confirmée', 'En préparation', 'Expédiée', 'Terminée', 'Annulée', 'Remboursée'];

  commandeSelectionnee: Order | null = null;
  chargementDetail: boolean = false;
  ongletDetail: 'infos' | 'suivi' = 'infos';

  readonly etapesProgression = ETAPES_PROGRESSION;
  telechargementFactureEnCours = false;

  constructor(
    private ordersService: OrdersService,
    private confirmDialogService: ConfirmDialogService,
    private authService: AuthService,
    private cartService: CartService,
    private router: Router
  ) {}

  get client() {
    return this.authService.currentUser;
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.ordersService
      .list({ recherche: this.recherche, statut: this.statutFiltre, page: this.page, limite: 8 })
      .subscribe({
        next: res => {
          this.commandes = res.commandes;
          this.totalPages = res.totalPages || 1;
          this.chargement = false;
        },
        error: () => {
          this.erreur = 'Impossible de charger vos commandes.';
          this.chargement = false;
        }
      });
  }

  rechercher(): void {
    this.page = 1;
    this.charger();
  }

  filtrerParStatut(statut: string): void {
    this.statutFiltre = statut;
    this.page = 1;
    this.charger();
  }

  pagePrecedente(): void {
    if (this.page > 1) {
      this.page--;
      this.charger();
    }
  }

  pageSuivante(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.charger();
    }
  }

  statutInfo(statut: string): StatutInfo {
    return STATUTS_INFO[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  nombreArticles(commande: Order): number {
    return commande.items.reduce((acc, i) => acc + i.quantite, 0);
  }

  /** Dérivé de l'adresse enregistrée : aucun champ dédié en base (voir orders.controller.js). */
  modeLivraison(commande: Order): string {
    if (!commande.adresseLivraison) return 'Documents numériques uniquement';
    return commande.adresseLivraison === 'Retrait en magasin' ? 'Retrait en magasin' : 'Livraison à domicile';
  }

  voirDetail(commande: Order, onglet: 'infos' | 'suivi' = 'infos'): void {
    this.chargementDetail = true;
    this.commandeSelectionnee = commande;
    this.ongletDetail = onglet;
    this.ordersService.getOne(commande._id).subscribe({
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

  /** Timeline affichée dans l'onglet Suivi : historique réel, complété par le statut courant s'il n'y figure pas déjà. */
  timeline(commande: Order): HistoriqueStatut[] {
    const historique = commande.historique && commande.historique.length > 0
      ? [...commande.historique]
      : [{ statut: 'En attente', date: commande.createdAt }];

    const dernier = historique[historique.length - 1];
    if (dernier.statut !== commande.statut) {
      historique.push({ statut: commande.statut, date: commande.updatedAt || commande.createdAt });
    }
    return historique;
  }

  peutAnnuler(commande: Order): boolean {
    return commande.statut === 'En attente';
  }

  /** Index de l'étape courante dans la progression linéaire (-1 si la commande est annulée). */
  etapeActuelleIndex(commande: Order): number {
    return this.etapesProgression.indexOf(commande.statut);
  }

  /** Sous-total réel recalculé depuis les articles (le total stocké inclut d'éventuels frais de livraison). */
  sousTotalCommande(commande: Order): number {
    return commande.items.reduce((acc, i) => acc + i.prix * i.quantite, 0);
  }

  fraisLivraisonCommande(commande: Order): number {
    return Math.max(commande.total - this.sousTotalCommande(commande), 0);
  }

  /** Libellé dérivé du statut réel de la commande : aucun statut de paiement séparé n'est stocké en base. */
  statutPaiementLabel(commande: Order): string {
    if (commande.statut === 'Annulée') return 'Annulé';
    if (commande.statut === 'Terminée') return 'Payé';
    return 'En attente';
  }

  badgeItem(item: OrderItem): string {
    return item.estDocument ? '📄 Document numérique' : '🎒 Fourniture scolaire';
  }

  async annuler(commande: Order): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: "Confirmation d'annulation",
      message: 'Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.',
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Confirmer'
    });
    if (!confirme) return;

    this.erreur = '';
    this.ordersService.cancel(commande._id).subscribe({
      next: () => {
        if (this.commandeSelectionnee?._id === commande._id) this.fermerDetail();
        this.succes = `La commande ${commande.numero} a bien été annulée.`;
        setTimeout(() => (this.succes = ''), 5000);
        this.charger();
      },
      error: () => (this.erreur = "Erreur lors de l'annulation de la commande.")
    });
  }

  /** Réinjecte les articles d'une commande passée dans le panier courant, puis ouvre le paiement. */
  commanderDeNouveau(commande: Order): void {
    commande.items.forEach(item => {
      this.cartService.ajouter(
        {
          id: item.produitId ?? this.idDepuisTitre(item.titre),
          titre: item.titre,
          categorie: item.categorie || '',
          prix: item.prix,
          icone: item.image || 'fa-box',
          variante: item.variante,
          estDocument: item.estDocument,
          produitId: item.produitId,
          type: item.type,
          auteur: item.auteur
        },
        item.quantite
      );
    });
    this.router.navigate(['/panier']);
  }

  /** Identifiant de secours si une ancienne commande n'a pas de produitId enregistré. */
  private idDepuisTitre(titre: string): number {
    let hash = 0;
    for (let i = 0; i < titre.length; i++) {
      hash = (hash * 31 + titre.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  imprimerFacture(): void {
    window.print();
  }

  telechargerFacture(commande: Order): void {
    this.telechargementFactureEnCours = true;
    this.ordersService.telechargerFacture(commande._id).subscribe({
      next: blob => {
        this.telechargementFactureEnCours = false;
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `Facture-${commande.numero}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.telechargementFactureEnCours = false;
        this.erreur = 'Impossible de télécharger la facture pour le moment.';
      }
    });
  }

  trackById(_index: number, item: Order): string {
    return item._id;
  }
}
