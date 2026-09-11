import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { CartService, PanierItem } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { OrdersService } from '../services/orders.service';
import { PaymentsService } from '../services/payments.service';
import { GOUVERNORATS_TUNISIE, delegationsPourGouvernorat } from '../shared/tunisie-geo.data';

type MoyenPaiement = 'livraison' | 'carte';
/** Étapes du wizard de commande — la 3ᵉ étape (confirmation) réutilise l'écran existant
 *  piloté par `orderConfirmed`, elle n'a pas besoin d'une valeur dédiée ici. */
type EtapeCheckout = 'livraison' | 'paiement';

/** Lettres (accents compris), espaces, apostrophes et tirets — pour prénom/nom/titulaire carte. */
const NOM_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

@Component({
  selector: 'app-panier',
  templateUrl: './panier.component.html',
  styleUrls: ['./panier.component.css']
})
export class PanierComponent implements OnInit, OnDestroy {

  items: PanierItem[] = [];
  private cartSub!: Subscription;
  private formSubs: Subscription[] = [];

  readonly gouvernorats: string[] = GOUVERNORATS_TUNISIE.map(g => g.nom);
  delegations: string[] = [];

  isCheckoutOpen     = false;
  orderSubmitted     = false;
  orderConfirmed     = false;
  chargementCommande = false;
  erreurCommande      = '';
  montantCommande    = 0;
  /** Points fidélité que rapporterait le panier — estimé à l'étape Paiement (avant validation). */
  pointsEstimes      = 0;
  /** Points réellement crédités sur la carte fidélité du client (renvoyés par le serveur après
   *  l'enregistrement) — affichés sur l'écran de confirmation. */
  pointsGagnes       = 0;
  /** Capturé avant le vidage du panier : affiche un raccourci « Mes documents » si pertinent. */
  derniereCommandeContientDocuments = false;
  /** Capturé avant le vidage du panier : affiché sur l'écran de confirmation pour un achat sans compte. */
  derniereCommandeEmail = '';

  checkoutForm!: FormGroup;

  /** Paiement en ligne (Konnect) : redirection en cours vers la page de paiement hébergée —
   *  distinct de `chargementCommande` (paiement à la livraison, enregistrement direct). */
  redirectionKonnectEnCours = false;

  // ── Wizard de commande (Livraison → Paiement → Confirmation) ──
  etapeCheckout: EtapeCheckout = 'livraison';
  /** Champs du formulaire unique (checkoutForm, inchangé) validés avant de passer à l'étape Paiement. */
  private readonly champsEtapeLivraison = [
    'prenom', 'nom', 'email', 'telephone', 'telephoneSecondaire',
    'typeLivraison', 'gouvernorat', 'delegation'
  ];

  // ── Carte "Gagnez du temps" : création de compte / connexion sociale au-dessus du formulaire ──
  compteCardMasquee = false;
  afficherFormulaireCompte = false;
  compteForm!: FormGroup;
  compteSubmitted = false;
  compteChargement = false;
  compteErreur = '';
  oauthChargement: 'google' | 'facebook' | null = null;
  oauthErreur = '';

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private authService: AuthService,
    private userService: UserService,
    private ordersService: OrdersService,
    private paymentsService: PaymentsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartSub = this.cartService.items$.subscribe(items => this.items = items);

    this.checkoutForm = this.fb.group({
      /* ── Coordonnées ── */
      prenom:              ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(NOM_PATTERN)]],
      nom:                 ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(NOM_PATTERN)]],
      email:                ['', [Validators.email, Validators.maxLength(100)]],
      telephone:           ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      telephoneSecondaire: ['', [Validators.pattern(/^[0-9]{8}$/)]],
      /* ── Adresse ── */
      gouvernorat:   ['', Validators.required],
      delegation:    ['', Validators.required],
      adresseDetaillee: ['', Validators.maxLength(200)],
      /* ── Options ── */
      typeLivraison: ['domicile', Validators.required],
      moyenPaiement: ['livraison', Validators.required],
      commentaire:   ['', Validators.maxLength(500)],
    });

    this.compteForm = this.fb.group({
      prenom:       ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(NOM_PATTERN)]],
      nom:          ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(NOM_PATTERN)]],
      email:        ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telephone:    ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      motDePasse:   ['', [Validators.required, Validators.minLength(6), Validators.maxLength(50)]],
      confirmation: ['', [Validators.required]],
    }, { validators: this.motsDePasseIdentiquesValidator });

    this.formSubs.push(
      this.checkoutForm.get('typeLivraison')!.valueChanges.subscribe(val => this.majValidateursAdresse(val))
    );
    this.formSubs.push(
      this.checkoutForm.get('gouvernorat')!.valueChanges.subscribe(gouvernorat => {
        this.delegations = delegationsPourGouvernorat(gouvernorat);
        const ctrl = this.checkoutForm.get('delegation')!;
        if (!this.delegations.includes(ctrl.value)) {
          ctrl.setValue('', { emitEvent: false });
        }
      })
    );

    // Permet au panier latéral de la Boutique de renvoyer directement vers le paiement
    // via un lien "Commander" (/panier?checkout=1), sans dupliquer le formulaire de commande.
    if (this.route.snapshot.queryParamMap.get('checkout') && this.cartService.items.length > 0) {
      this.openCheckout();
    }
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    this.formSubs.forEach(s => s.unsubscribe());
    document.body.classList.remove('ub-no-scroll');
  }

  get estConnecte(): boolean {
    return this.authService.isConnecte;
  }

  /* ── Panier ────────────────────────────────────────────────── */

  private readonly FRAIS_LIVRAISON = 8;

  get sousTotal(): number {
    return this.items.reduce((acc, i) => acc + i.prix * i.quantite, 0);
  }

  /** Aucune logique de remise dans l'application : toujours 0, exposé pour l'affichage du résumé. */
  get remise(): number {
    return 0;
  }

  get nombreArticles(): number {
    return this.items.reduce((acc, i) => acc + i.quantite, 0);
  }

  get fraisLivraison(): number {
    if (!this.commandeContientFournitures) return 0;
    return this.checkoutForm?.get('typeLivraison')?.value === 'retrait' ? 0 : this.FRAIS_LIVRAISON;
  }

  get total(): number { return this.sousTotal + this.fraisLivraison; }

  /** Une adresse de livraison n'a de sens que si le panier contient au moins une fourniture scolaire. */
  get commandeContientFournitures(): boolean {
    return this.items.some(i => !i.estDocument);
  }

  /** Une commande sans compte contenant un document numérique n'a aucun autre moyen de le
   * recevoir que par e-mail (aucun compte créé, donc pas d'espace « Mes Documents ») — l'e-mail
   * n'est donc obligatoire que dans ce cas précis, jamais pour une commande 100% fournitures. */
  get emailRequisPourCommande(): boolean {
    return !this.estConnecte && this.items.some(i => i.estDocument);
  }

  formatPrix(v: number): string {
    return v.toFixed(3).replace('.', ',') + ' د.ت';
  }

  reference(item: PanierItem): string {
    return 'REF-' + String(item.id).padStart(4, '0');
  }

  trackById(_index: number, item: PanierItem): number {
    return item.id;
  }

  incrementer(item: PanierItem): void {
    this.cartService.incrementer(item.id, item.variante);
  }

  decrementer(item: PanierItem): void {
    this.cartService.decrementer(item.id, item.variante);
  }

  supprimer(item: PanierItem): void {
    this.cartService.supprimer(item.id, item.variante);
  }

  /* ── Modal checkout ────────────────────────────────────────── */

  openCheckout(): void {
    this.isCheckoutOpen     = true;
    this.orderSubmitted     = false;
    this.orderConfirmed     = false;
    this.erreurCommande     = '';
    this.redirectionKonnectEnCours = false;
    this.delegations        = [];
    this.pointsGagnes       = 0;
    this.chargerEstimationPoints();
    this.checkoutForm.reset({ typeLivraison: 'domicile', moyenPaiement: 'livraison' });

    // Wizard + carte "Gagnez du temps" : repartent toujours de l'étape Livraison à
    // l'ouverture (la carte reste masquée si l'utilisateur est déjà connecté).
    this.etapeCheckout = 'livraison';
    this.compteCardMasquee = false;
    this.afficherFormulaireCompte = false;
    this.compteSubmitted = false;
    this.compteErreur = '';
    this.oauthErreur = '';
    this.oauthChargement = null;
    this.compteForm.reset();

    // E-mail obligatoire uniquement pour un achat sans compte contenant un document numérique
    // (seul moyen de le recevoir sans compte créé — voir orders.controller.js#create) ; optionnel
    // pour une commande 100% fournitures scolaires, le téléphone suffisant pour la livraison.
    const emailCtrl = this.checkoutForm.get('email')!;
    emailCtrl.setValidators(this.emailRequisPourCommande ? [Validators.required, Validators.email] : [Validators.email]);
    emailCtrl.updateValueAndValidity({ emitEvent: false });

    if (this.estConnecte) {
      this.preremplirDepuisCompte();
    }

    document.body.classList.add('ub-no-scroll');
  }

  /** Découpe un nom complet ("Prénom Nom" / "Prénom composé Nom") en { prenom, nom } quand le
   *  prénom n'est pas renseigné séparément — dernier mot = nom, le reste = prénom. Un seul mot
   *  reste dans `nom`. */
  private separerNom(prenom: string, nom: string): { prenom: string; nom: string } {
    if (prenom.trim()) return { prenom: prenom.trim(), nom: nom.trim() };
    const mots = nom.trim().split(/\s+/).filter(Boolean);
    if (mots.length < 2) return { prenom: '', nom: nom.trim() };
    return { prenom: mots.slice(0, -1).join(' '), nom: mots[mots.length - 1] };
  }

  private preremplirDepuisCompte(): void {
    const utilisateur = this.authService.currentUser;
    if (!utilisateur) return;

    const initial = this.separerNom(utilisateur.prenom || '', utilisateur.nom || '');
    this.checkoutForm.patchValue({
      prenom: initial.prenom,
      nom: initial.nom,
      email: utilisateur.email || '',
      telephone: utilisateur.telephone || ''
    });

    // Profil complet (source autoritaire : `prenom`/`nom` séparés, tél. secondaire) — le
    // `currentUser` du JWT n'a souvent qu'un `nom` sans `prenom`.
    this.userService.getProfile().subscribe({
      next: profil => {
        const p = this.separerNom(profil.prenom || '', profil.nom || '');
        this.checkoutForm.patchValue({
          prenom: p.prenom || this.checkoutForm.get('prenom')?.value || '',
          nom: p.nom || this.checkoutForm.get('nom')?.value || '',
          email: profil.email || this.checkoutForm.get('email')?.value || '',
          telephone: profil.telephone || this.checkoutForm.get('telephone')?.value || '',
          telephoneSecondaire: profil.telephoneSecondaire || ''
        });
      },
      error: () => { /* profil indisponible : on garde le pré-remplissage minimal ci-dessus */ }
    });

    this.userService.getAdresses().subscribe({
      next: adresses => {
        const adresseParDefaut = adresses.find(a => a.parDefaut) || adresses[0];
        if (!adresseParDefaut) return;

        if (adresseParDefaut.gouvernorat) {
          this.delegations = delegationsPourGouvernorat(adresseParDefaut.gouvernorat);
        }
        const detail = [adresseParDefaut.ligne1, adresseParDefaut.ligne2, adresseParDefaut.ville, adresseParDefaut.codePostal]
          .map(v => (v || '').trim()).filter(Boolean).join(', ');
        this.checkoutForm.patchValue({
          gouvernorat: adresseParDefaut.gouvernorat || '',
          delegation: adresseParDefaut.delegation || '',
          adresseDetaillee: detail
        });
      }
    });
  }

  closeCheckout(): void {
    this.isCheckoutOpen = false;
    document.body.classList.remove('ub-no-scroll');
  }

  /** Items de commande envoyés au serveur (mêmes champs pour l'estimation de points et la création). */
  private itemsPayload() {
    return this.items.map(i => ({
      titre: i.titre, prix: i.prix, quantite: i.quantite, image: i.icone,
      estDocument: i.estDocument, produitId: i.produitId, categorie: i.categorie,
      type: i.type, auteur: i.auteur, variante: i.variante
    }));
  }

  /** Interroge le serveur (source de vérité : pointFidelite des fiches ProduitCaisse) pour savoir
   *  combien de points le panier rapportera. Best-effort : un échec laisse simplement 0. */
  private chargerEstimationPoints(): void {
    if (this.items.length === 0) { this.pointsEstimes = 0; return; }
    this.ordersService.estimationPoints(this.itemsPayload()).subscribe({
      next: res => (this.pointsEstimes = res.points || 0),
      error: () => (this.pointsEstimes = 0)
    });
  }

  /* ── Carte "Gagnez du temps" : compte / connexion sociale ──────────────────── */

  toggleFormulaireCompte(): void {
    this.afficherFormulaireCompte = !this.afficherFormulaireCompte;
    this.compteErreur = '';
  }

  /** Ignorer la carte et continuer en tant qu'invité (le formulaire de livraison reste
   *  utilisable normalement, aucune fonctionnalité existante n'est retirée). */
  continuerInvite(): void {
    this.compteCardMasquee = true;
  }

  /** L'utilisateur a déjà un compte : direction /login, puis retour sur /panier avec le
   *  tunnel de commande rouvert (`returnUrl` honoré par LoginComponent). */
  seConnecter(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/panier?checkout=1' } });
  }

  private motsDePasseIdentiquesValidator(group: AbstractControl): ValidationErrors | null {
    const motDePasse = group.get('motDePasse')?.value;
    const confirmation = group.get('confirmation')?.value;
    return motDePasse && confirmation && motDePasse !== confirmation ? { mismatch: true } : null;
  }

  compteFieldInvalid(name: string): boolean {
    const ctrl = this.compteForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || this.compteSubmitted));
  }

  compteFieldError(name: string): string {
    const ctrl = this.compteForm.get(name);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'Ce champ est obligatoire.';
    if (ctrl.errors['email'])     return 'Adresse e-mail invalide.';
    if (ctrl.errors['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} caractères requis.`;
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} caractères autorisés.`;
    if (ctrl.errors['pattern']) {
      const msgs: Record<string, string> = {
        prenom: 'Seules les lettres sont autorisées.',
        nom: 'Seules les lettres sont autorisées.',
        telephone: 'Numéro à 8 chiffres requis (ex : 22 345 678).',
      };
      return msgs[name] ?? 'Format invalide.';
    }
    return '';
  }

  get motsDePasseDifferents(): boolean {
    return !!this.compteForm?.errors?.['mismatch'] && !!this.compteForm.get('confirmation')?.touched;
  }

  /** Crée le compte, connecte automatiquement l'utilisateur (AuthService.register stocke déjà
   *  le token/l'utilisateur) puis pré-remplit le formulaire de livraison avec ses informations. */
  creerCompte(): void {
    this.compteSubmitted = true;
    this.compteErreur = '';
    if (this.compteForm.invalid) return;

    const v = this.compteForm.value;
    this.compteChargement = true;
    this.authService.register({
      nom: v.nom,
      prenom: v.prenom,
      email: v.email,
      telephone: v.telephone,
      motDePasse: v.motDePasse
    }).subscribe({
      next: () => {
        this.compteChargement = false;
        this.afficherFormulaireCompte = false;
        this.preremplirDepuisCompte();
      },
      error: (err: HttpErrorResponse) => {
        this.compteChargement = false;
        this.compteErreur = err.error?.message || 'Une erreur est survenue lors de la création du compte.';
      }
    });
  }

  /**
   * Le vrai widget Google (Identity Services, voir app/login/login.component.ts#initGoogle)
   * exige son propre bouton rendu par Google — impossible à obtenir depuis ce bouton personnalisé
   * (ck-btn-compte--google) sans perdre son style ici. Redirige vers la page de connexion, qui
   * porte l'intégration réelle, plutôt que de dupliquer le rendu du widget dans ce panneau de
   * checkout invité.
   */
  connexionGoogle(): void {
    this.oauthErreur = '';
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/panier' } });
  }

  connexionFacebook(): void {
    this.oauthErreur = '';
    this.oauthChargement = 'facebook';
    this.authService.loginWithFacebook().subscribe({
      next: () => {
        this.oauthChargement = null;
        this.preremplirDepuisCompte();
      },
      error: (err: HttpErrorResponse) => {
        this.oauthChargement = null;
        this.oauthErreur = err.error?.message || 'Connexion avec Facebook indisponible pour le moment.';
      }
    });
  }

  /* ── Wizard : étape Livraison → étape Paiement ──────────────────────────────
     Le formulaire réactif (checkoutForm) reste unique et inchangé : on ne fait que
     valider un sous-ensemble de ses champs avant de révéler l'étape suivante — les
     valeurs saisies ne sont jamais perdues, et la soumission finale (onSubmitOrder)
     revalide de toute façon l'ensemble du formulaire. */

  validerEtapeLivraison(): void {
    let toutValide = true;
    for (const nom of this.champsEtapeLivraison) {
      const ctrl = this.checkoutForm.get(nom);
      if (ctrl && ctrl.invalid) {
        ctrl.markAsTouched();
        toutValide = false;
      }
    }
    if (!toutValide) {
      this.orderSubmitted = true;
      const el = document.querySelector('.ck-input.is-invalid, select.is-invalid');
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.etapeCheckout = 'paiement';
    this.chargerEstimationPoints();
    document.querySelector('.ck-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  etapePrecedente(): void {
    this.etapeCheckout = 'livraison';
    document.querySelector('.ck-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isCheckoutOpen && !this.orderConfirmed) this.closeCheckout();
  }

  /* ── Mode de livraison : adresse obligatoire seulement à domicile ───── */

  private majValidateursAdresse(typeLivraison: string): void {
    // Aucune adresse requise pour un panier 100 % documents numériques (rien à livrer),
    // ni pour un retrait en magasin.
    const adresseRequise = typeLivraison !== 'retrait' && this.commandeContientFournitures;
    const champsAdresse: [string, ValidatorFn[]][] = [
      ['gouvernorat', [Validators.required]],
      ['delegation', [Validators.required]],
    ];
    for (const [nom, validateurs] of champsAdresse) {
      const ctrl = this.checkoutForm.get(nom);
      if (!ctrl) continue;
      ctrl.setValidators(adresseRequise ? validateurs : []);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  /* ── Mode de paiement ─────────────────────────────────────────────── */

  get moyenPaiement(): MoyenPaiement {
    return this.checkoutForm?.get('moyenPaiement')?.value || 'livraison';
  }

  get moyenPaiementLabel(): string {
    const labels: Record<MoyenPaiement, string> = {
      livraison: 'Paiement à la livraison',
      carte: 'Paiement en ligne (Konnect)',
    };
    return labels[this.moyenPaiement];
  }

  /* ── Helpers de validation ─────────────────────────────────── */

  fieldInvalid(name: string): boolean {
    const ctrl = this.checkoutForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || this.orderSubmitted));
  }

  getFieldError(name: string): string {
    const ctrl = this.checkoutForm.get(name);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'Ce champ est obligatoire.';
    if (ctrl.errors['email'])     return 'Adresse e-mail invalide.';
    if (ctrl.errors['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} caractères requis.`;
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} caractères autorisés.`;
    if (ctrl.errors['pattern']) {
      const msgs: Record<string, string> = {
        prenom: 'Seules les lettres sont autorisées.',
        nom: 'Seules les lettres sont autorisées.',
        telephone: 'Numéro à 8 chiffres requis (ex : 22 345 678).',
        telephoneSecondaire: 'Numéro à 8 chiffres requis (ex : 22 345 678).',
      };
      return msgs[name] ?? 'Format invalide.';
    }
    return '';
  }

  /** Empêche la saisie de caractères hors du motif autorisé (ex : lettres seules, chiffres
   *  seuls) directement au clavier/collage, en plus de la validation du FormControl. */
  private filtrerCaracteres(control: AbstractControl | null, event: Event, interdits: RegExp): void {
    const input = event.target as HTMLInputElement;
    const filtre = input.value.replace(interdits, '');
    if (filtre !== input.value) {
      input.value = filtre;
    }
    control?.setValue(filtre);
  }

  /** À utiliser sur les champs nom/prénom/titulaire carte : lettres, espaces, apostrophes, tirets. */
  filtrerLettres(event: Event, form: FormGroup, controlName: string): void {
    this.filtrerCaracteres(form.get(controlName), event, /[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g);
  }

  /** À utiliser sur les champs téléphone : chiffres uniquement. */
  filtrerChiffres(event: Event, form: FormGroup, controlName: string): void {
    this.filtrerCaracteres(form.get(controlName), event, /\D/g);
  }

  /* ── Soumission ────────────────────────────────────────────── */

  onSubmitOrder(): void {
    this.orderSubmitted = true;
    this.erreurCommande = '';
    if (this.checkoutForm.invalid) {
      const el = document.querySelector('.ck-input.is-invalid, select.is-invalid');
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.derniereCommandeContientDocuments = this.items.some(i => i.estDocument);
    if (this.moyenPaiement === 'carte') {
      this.initierPaiementEnLigne();
    } else {
      this.enregistrerCommande();
    }
  }

  /** Payload commun aux deux moyens de paiement (voir orders.controller.js#construireCommande,
   *  partagé par POST /orders et POST /payments/konnect/initier). */
  private payloadCommande() {
    const valeurs = this.checkoutForm.value;
    const adresseLivraison =
      valeurs.typeLivraison === 'retrait'
        ? 'Retrait en magasin'
        : this.commandeContientFournitures
          ? [valeurs.adresseDetaillee, valeurs.delegation, valeurs.gouvernorat]
              .map((v: string) => (v || '').trim()).filter(Boolean).join(', ')
          : '';

    return {
      items: this.itemsPayload(),
      total: this.total,
      paiement: this.moyenPaiementLabel,
      adresseLivraison,
      gouvernorat: this.commandeContientFournitures ? valeurs.gouvernorat : '',
      delegation: this.commandeContientFournitures ? valeurs.delegation : '',
      commentaire: (valeurs.commentaire || '').trim(),
      invite: this.estConnecte ? undefined : {
        nom: valeurs.nom, prenom: valeurs.prenom, telephone: valeurs.telephone, email: valeurs.email
      }
    };
  }

  /**
   * Enregistre réellement la commande côté serveur, avec ou sans compte (l'API accepte
   * désormais les deux — voir orders.controller.js#create). Un achat sans compte transmet
   * les coordonnées saisies dans `invite` ; le backend recherche automatiquement un compte
   * existant par e-mail avant de créer un accès invité.
   *
   * « Paiement en ligne » (Konnect) suit un chemin différent (initierPaiementEnLigne ci-dessous) :
   * ici, uniquement le paiement à la livraison, où la commande est finalisée tout de suite.
   */
  private enregistrerCommande(): void {
    const valeurs = this.checkoutForm.value;
    this.derniereCommandeEmail = valeurs.email || this.authService.currentUser?.email || '';

    this.chargementCommande = true;
    this.ordersService.create(this.payloadCommande()).subscribe({
      next: res => {
        this.chargementCommande = false;
        this.montantCommande = this.total;
        this.pointsGagnes = res.pointsFidelite || 0;
        this.orderConfirmed = true;
        this.cartService.vider();
      },
      error: err => {
        this.chargementCommande = false;
        this.erreurCommande = err.error?.message || "Erreur lors de l'enregistrement de la commande.";
      }
    });
  }

  /**
   * « Paiement en ligne » (Konnect) : la commande est enregistrée côté serveur (statut "En
   * attente", non finalisée — voir payments.controller.js#initierKonnect) puis le navigateur est
   * redirigé EN ENTIER vers la page de paiement hébergée Konnect (jamais un simple lien Angular :
   * il s'agit d'un domaine externe). Le panier n'est vidé qu'après un paiement confirmé — voir
   * PaiementRetourComponent, qui gère le retour succès/échec.
   */
  private initierPaiementEnLigne(): void {
    this.chargementCommande = true;
    this.paymentsService.initierKonnect(this.payloadCommande()).subscribe({
      next: res => {
        this.redirectionKonnectEnCours = true;
        window.location.href = res.payUrl;
      },
      error: err => {
        this.chargementCommande = false;
        this.erreurCommande = err.error?.message || "Erreur lors de l'initialisation du paiement en ligne.";
      }
    });
  }
}
