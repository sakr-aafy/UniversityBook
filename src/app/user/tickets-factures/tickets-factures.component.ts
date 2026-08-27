import { Component, OnInit } from '@angular/core';
import { MesAchatsService, Ticket, Facture, CarteFidelite, ModePaiementFacture } from '../../services/mes-achats.service';

type Onglet = 'tickets' | 'factures' | 'fidelite';

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
  carte: CarteFidelite | null = null;
  chargement: boolean = true;
  erreur: string = '';

  ticketSelectionne: Ticket | null = null;
  factureSelectionnee: Facture | null = null;

  // ── Sélection multiple de tickets → création de facture ──
  modeSelection: boolean = false;
  ticketsCoches = new Set<string>();
  creationFactureEnCours: boolean = false;

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
        this.chargerCarte();
      },
      error: () => {
        this.erreur = 'Impossible de charger vos achats en magasin pour le moment.';
        this.chargement = false;
      }
    });
  }

  /** Carte fidélité / crédit : optionnelle (l'utilisateur peut ne pas avoir de fiche client
   *  caisse) — un échec ne bloque jamais l'affichage des tickets/factures. */
  private chargerCarte(): void {
    this.mesAchatsService.maCarteFidelite().subscribe({
      next: res => { this.carte = res.carte; this.chargement = false; },
      error: () => { this.carte = null; this.chargement = false; }
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

  statutTicketInfo(statut: string): StatutTicketInfo {
    return STATUTS_TICKET[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  statutFactureInfo(statut: string): StatutFactureInfo {
    return STATUTS_FACTURE[statut] || { label: statut, couleur: '#3C444E', fond: '#F0F1F4', icone: 'fa-circle' };
  }

  nombreArticlesTicket(t: Ticket): number {
    return t.lignes.reduce((acc, l) => acc + l.qte, 0);
  }

  voirTicket(t: Ticket): void {
    if (this.modeSelection) { this.basculerCoche(t); return; }
    this.ticketSelectionne = t;
  }
  fermerTicket(): void { this.ticketSelectionne = null; }

  // ── Facturation d'une sélection de tickets ──────────────────────────────
  /** Un ticket est facturable s'il est valide et pas déjà rattaché à une facture. */
  peutFacturer(t: Ticket): boolean {
    return t.statut === 'valide' && !t.dejaFacture;
  }

  basculerModeSelection(): void {
    this.modeSelection = !this.modeSelection;
    this.ticketsCoches.clear();
  }

  basculerCoche(t: Ticket): void {
    if (!this.peutFacturer(t)) return;
    if (this.ticketsCoches.has(t.id)) this.ticketsCoches.delete(t.id);
    else this.ticketsCoches.add(t.id);
  }

  estCoche(t: Ticket): boolean { return this.ticketsCoches.has(t.id); }

  get nbTicketsFacturables(): number {
    return this.tickets.filter(t => this.peutFacturer(t)).length;
  }

  get totalSelection(): number {
    return this.tickets
      .filter(t => this.ticketsCoches.has(t.id))
      .reduce((s, t) => s + t.totalTTC, 0);
  }

  creerFactureDepuisSelection(): void {
    const ids = [...this.ticketsCoches];
    if (ids.length === 0 || this.creationFactureEnCours) return;
    this.creationFactureEnCours = true;
    this.erreur = '';
    this.mesAchatsService.creerFacture(ids).subscribe({
      next: res => {
        this.creationFactureEnCours = false;
        this.modeSelection = false;
        this.ticketsCoches.clear();
        this.factures = [res.facture, ...this.factures];
        // Recharge les tickets pour refléter leur nouveau statut "déjà facturé".
        this.mesAchatsService.mesTickets().subscribe({ next: r => (this.tickets = r.tickets) });
        this.ongletActif = 'factures';
      },
      error: err => {
        this.creationFactureEnCours = false;
        this.erreur = err.error?.message || 'Impossible de créer la facture.';
      }
    });
  }

  /** TVA totale d'une facture = somme des TVA de ses lignes (ventilées à la création). */
  tvaFacture(f: Facture): number {
    return f.produits.reduce((s, l) => s + (l.tva || 0), 0);
  }

  // ── Détail / règlement facture ─────────────────────────────────────────
  modePaiementChoisi: ModePaiementFacture | null = null;
  paiementEnCours: boolean = false;
  paiementMessage: string = '';

  voirFacture(f: Facture): void {
    this.factureSelectionnee = f;
    this.modePaiementChoisi = null;
    this.paiementMessage = '';
  }
  fermerFacture(): void { this.factureSelectionnee = null; }

  /** Le timbre fiscal n'est dû (et affiché/imprimé) que sur une facture réglée. */
  timbreAffiche(f: Facture): number {
    return f.statut === 'payee' ? (f.timbreFiscal || 0) : 0;
  }

  /** Total affiché = articles + TVA (déjà dans `total`), + timbre fiscal seulement si payée. */
  totalFactureAffiche(f: Facture): number {
    return f.total + this.timbreAffiche(f);
  }

  /** Seul « Points fidélité » est réglable en ligne pour l'instant ; D17 et carte bancaire ne
   *  sont pas encore activés (règlement en magasin). */
  modePaiementActif(mode: ModePaiementFacture): boolean {
    return mode === 'points';
  }

  choisirModePaiement(mode: ModePaiementFacture): void {
    this.modePaiementChoisi = mode;
    this.paiementMessage = this.modePaiementActif(mode)
      ? ''
      : (mode === 'd17'
          ? "Le paiement par D17 n'est pas encore activé. Réglez avec vos points fidélité, ou en magasin."
          : "Le paiement par carte bancaire n'est pas encore activé. Réglez avec vos points fidélité, ou en magasin.");
  }

  payerFacture(): void {
    const f = this.factureSelectionnee;
    if (!f || !this.modePaiementChoisi || this.paiementEnCours) return;
    if (!this.modePaiementActif(this.modePaiementChoisi)) {
      this.paiementMessage = "Ce mode de paiement n'est pas encore activé. Réglez avec vos points fidélité, ou en magasin.";
      return;
    }
    this.paiementEnCours = true;
    this.paiementMessage = '';
    this.mesAchatsService.payerFacture(f.id, this.modePaiementChoisi).subscribe({
      next: res => {
        this.paiementEnCours = false;
        this.factureSelectionnee = res.facture;
        this.factures = this.factures.map(x => x.id === res.facture.id ? res.facture : x);
        this.paiementMessage = res.pointsUtilises
          ? `Facture réglée — ${res.pointsUtilises} points utilisés (solde : ${res.pointsRestants} pts).`
          : 'Facture réglée.';
        // Le solde de points a pu changer : on rafraîchit la carte.
        this.mesAchatsService.maCarteFidelite().subscribe({ next: r => (this.carte = r.carte) });
      },
      error: err => {
        this.paiementEnCours = false;
        this.paiementMessage = err.error?.message || 'Le règlement a échoué.';
      }
    });
  }

  /** window.print() imprime toute la page par défaut (sidebar, header...) — la classe
   *  .ub-printing (voir styles.css) n'affiche que l'élément .ub-print-area (le modal ouvert)
   *  le temps de l'impression. Retrait sur onafterprint plutôt que juste après window.print()
   *  (synchrone ou non selon le navigateur) pour ne jamais retirer la classe trop tôt. */
  imprimer(): void {
    document.body.classList.add('ub-printing');
    const retirer = () => {
      document.body.classList.remove('ub-printing');
      window.removeEventListener('afterprint', retirer);
    };
    window.addEventListener('afterprint', retirer);
    window.print();
  }

  trackByTicket(_index: number, item: Ticket): string { return item.id; }
  trackByFacture(_index: number, item: Facture): string { return item.id; }
}
