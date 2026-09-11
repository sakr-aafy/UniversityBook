import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentsService } from '../services/payments.service';
import { CartService } from '../services/cart.service';

type EtatRetour = 'verification' | 'succes' | 'echec' | 'attente_prolongee' | 'erreur';

/**
 * Page de retour du paiement en ligne Konnect (successUrl/failUrl, voir
 * payments.controller.js#initierKonnect) — accessible sans compte (client invité possible).
 *
 * Le paramètre `statut` de l'URL (succes/echec) n'est qu'une INDICATION de Konnect au moment de
 * la redirection, jamais une preuve : la seule source de vérité est notre propre webhook, déjà
 * en train de vérifier le paiement côté serveur (souvent avant même que ce composant ne s'affiche).
 * On interroge donc `statutKonnect` en boucle courte plutôt que de faire confiance à l'URL —
 * même principe que payments.controller.js#webhookKonnect ("ne jamais faire confiance au signal,
 * toujours revérifier la source").
 */
@Component({
  selector: 'app-paiement-retour',
  templateUrl: './paiement-retour.component.html',
  styleUrls: ['./paiement-retour.component.css']
})
export class PaiementRetourComponent implements OnInit, OnDestroy {
  etat: EtatRetour = 'verification';
  numero = '';
  total = 0;
  erreur = '';

  private jeton = '';
  private tentative = 0;
  private readonly MAX_TENTATIVES = 10;
  private readonly INTERVALLE_MS = 2000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentsService: PaymentsService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.numero = params.get('commande') || '';
    this.jeton = params.get('jeton') || '';

    if (!this.numero || !this.jeton) {
      this.etat = 'erreur';
      this.erreur = 'Lien de retour invalide.';
      return;
    }

    this.verifier();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private verifier(): void {
    this.paymentsService.statutKonnect(this.numero, this.jeton).subscribe({
      next: res => {
        this.total = res.total;

        if (res.statutPaiementEnLigne === 'reussi') {
          this.etat = 'succes';
          // Le panier n'est vidé qu'ici, une fois le paiement RÉELLEMENT confirmé — jamais dès
          // la redirection vers Konnect (voir panier.component.ts#initierPaiementEnLigne).
          this.cartService.vider();
          return;
        }
        if (res.statutPaiementEnLigne === 'echoue') {
          this.etat = 'echec';
          return;
        }

        // Toujours 'en_attente' : le webhook Konnect n'est pas encore passé (rare, mais possible
        // en cas de lenteur réseau) — on réessaie quelques fois avant d'orienter vers un message
        // moins péremptoire plutôt que de faire tourner un spinner indéfiniment.
        this.tentative++;
        if (this.tentative >= this.MAX_TENTATIVES) {
          this.etat = 'attente_prolongee';
          return;
        }
        this.timer = setTimeout(() => this.verifier(), this.INTERVALLE_MS);
      },
      error: err => {
        this.etat = 'erreur';
        this.erreur = err.error?.message || 'Commande introuvable.';
      }
    });
  }

  formatPrix(v: number): string {
    return (v || 0).toFixed(3).replace('.', ',') + ' د.ت';
  }

  allerAccueil(): void {
    this.router.navigateByUrl('/');
  }

  allerBoutique(): void {
    this.router.navigateByUrl('/boutique');
  }

  reessayerPaiement(): void {
    this.router.navigateByUrl('/panier?checkout=1');
  }
}
