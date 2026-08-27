import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { CartService, PanierItem } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { OrdersService } from '../services/orders.service';
import { GOUVERNORATS_TUNISIE, delegationsPourGouvernorat } from '../shared/tunisie-geo.data';

type MoyenPaiement = 'livraison' | 'carte';
/** Étapes du wizard de commande — la 3ᵉ étape (confirmation) réutilise l'écran existant
 *  piloté par `orderConfirmed`, elle n'a pas besoin d'une valeur dédiée ici. */
type EtapeCheckout = 'livraison' | 'paiement';

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
  /** Capturé avant le vidage du panier : affiche un raccourci « Mes documents » si pertinent. */
  derniereCommandeContientDocuments = false;
  /** Capturé avant le vidage du panier : affiché sur l'écran de confirmation pour un achat sans compte. */
  derniereCommandeEmail = '';

  checkoutForm!: FormGroup;

  // ── Carte bancaire interactive ──
  carteFlipped = false;

  /** Message affiché si l'utilisateur tente de choisir « Paiement en ligne » (non encore actif). */
  paiementEnLigneMessage = '';
  private paiementEnLigneTimer: ReturnType<typeof setTimeout> | undefined;

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
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.cartSub = this.cartService.items$.subscribe(items => this.items = items);

    this.checkoutForm = this.fb.group({
      /* ── Coordonnées ── */
      prenom:              ['', [Validators.required, Validators.minLength(2)]],
      nom:                 ['', [Validators.required, Validators.minLength(2)]],
      email:                ['', [Validators.email]],
      telephone:           ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      telephoneSecondaire: ['', [Validators.pattern(/^[0-9]{8}$/)]],
      /* ── Adresse ── */
      gouvernorat:   ['', Validators.required],
      delegation:    ['', Validators.required],
      adresseDetaillee: [''],
      /* ── Options ── */
      typeLivraison: ['domicile', Validators.required],
      moyenPaiement: ['livraison', Validators.required],
      commentaire:   [''],
      /* ── Carte bancaire (validée uniquement si moyenPaiement === 'carte') ── */
      carteNumero:     [''],
      carteNom:        [''],
      carteExpiration: [''],
      carteCvv:        [''],
    });

    this.compteForm = this.fb.group({
      prenom:       ['', [Validators.required, Validators.minLength(2)]],
      nom:          ['', [Validators.required, Validators.minLength(2)]],
      email:        ['', [Validators.required, Validators.email]],
      telephone:    ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      motDePasse:   ['', [Validators.required, Validators.minLength(6)]],
      confirmation: ['', [Validators.required]],
    }, { validators: this.motsDePasseIdentiquesValidator });

    this.formSubs.push(
      this.checkoutForm.get('typeLivraison')!.valueChanges.subscribe(val => this.majValidateursAdresse(val))
    );
    this.formSubs.push(
      this.checkoutForm.get('moyenPaiement')!.valueChanges.subscribe(val => {
        // Paiement en ligne pas encore actif : on prévient et on revient au paiement à la livraison.
        if (val === 'carte') {
          this.paiementEnLigneMessage = "Le paiement en ligne n'est pas encore activé. Votre commande sera réglée à la livraison.";
          this.checkoutForm.get('moyenPaiement')!.setValue('livraison');
          clearTimeout(this.paiementEnLigneTimer);
          this.paiementEnLigneTimer = setTimeout(() => (this.paiementEnLigneMessage = ''), 6000);
          return;
        }
        this.majValidateursCarte(val);
      })
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
    clearTimeout(this.paiementEnLigneTimer);
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
    this.carteFlipped       = false;
    this.delegations        = [];
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
    if (ctrl.errors['pattern'])   return 'Numéro à 8 chiffres requis (ex : 22 345 678).';
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

  connexionGoogle(): void {
    this.oauthErreur = '';
    this.oauthChargement = 'google';
    this.authService.loginWithGoogle().subscribe({
      next: () => {
        this.oauthChargement = null;
        this.preremplirDepuisCompte();
      },
      error: (err: HttpErrorResponse) => {
        this.oauthChargement = null;
        this.oauthErreur = err.error?.message || 'Connexion avec Google indisponible pour le moment.';
      }
    });
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
      carte: 'Paiement en ligne',
    };
    return labels[this.moyenPaiement];
  }

  private majValidateursCarte(moyen: string): void {
    const carteActive = moyen === 'carte';
    const config: Record<string, ValidatorFn[]> = {
      carteNumero: [Validators.required, Validators.pattern(/^(\d{4} ){3}\d{4}$/)],
      carteNom: [Validators.required, Validators.minLength(3)],
      carteExpiration: [Validators.required, this.validerExpiration],
      carteCvv: [Validators.required, Validators.pattern(/^\d{3}$/)],
    };
    for (const nom of Object.keys(config)) {
      const ctrl = this.checkoutForm.get(nom);
      if (!ctrl) continue;
      ctrl.setValidators(carteActive ? config[nom] : []);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
    if (!carteActive) this.carteFlipped = false;
  }

  private validerExpiration(control: AbstractControl): ValidationErrors | null {
    const valeur: string = control.value || '';
    const correspondance = /^(\d{2})\/(\d{2})$/.exec(valeur);
    if (!correspondance) return { pattern: true };

    const mois = parseInt(correspondance[1], 10);
    const annee = 2000 + parseInt(correspondance[2], 10);
    if (mois < 1 || mois > 12) return { pattern: true };

    const maintenant = new Date();
    const finValidite = new Date(annee, mois, 0);
    if (finValidite < new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)) {
      return { expired: true };
    }
    return null;
  }

  /* ── Carte bancaire interactive : formatage en temps réel ────────── */

  onCarteNumeroInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chiffres = input.value.replace(/\D/g, '').slice(0, 16);
    const formate = (chiffres.match(/.{1,4}/g) || []).join(' ');
    this.checkoutForm.get('carteNumero')?.setValue(formate);
    input.value = formate;
  }

  onCarteExpirationInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let chiffres = input.value.replace(/\D/g, '').slice(0, 4);
    if (chiffres.length >= 3) {
      chiffres = chiffres.slice(0, 2) + '/' + chiffres.slice(2);
    }
    this.checkoutForm.get('carteExpiration')?.setValue(chiffres);
    input.value = chiffres;
  }

  get carteMarque(): 'visa' | 'mastercard' | '' {
    const numero = (this.checkoutForm?.get('carteNumero')?.value || '').replace(/\s/g, '');
    if (numero.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(numero)) return 'mastercard';
    return '';
  }

  onCvvFocus(): void {
    this.carteFlipped = true;
  }

  onCvvBlur(): void {
    this.carteFlipped = false;
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
    if (ctrl.errors['expired'])   return 'Cette carte est expirée.';
    if (ctrl.errors['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} caractères requis.`;
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} caractères autorisés.`;
    if (ctrl.errors['pattern']) {
      const msgs: Record<string, string> = {
        telephone: 'Numéro à 8 chiffres requis (ex : 22 345 678).',
        telephoneSecondaire: 'Numéro à 8 chiffres requis (ex : 22 345 678).',
        carteNumero: 'Numéro de carte incomplet (16 chiffres requis).',
        carteExpiration: 'Format attendu : MM/AA.',
        carteCvv: 'CVV à 3 chiffres requis.',
      };
      return msgs[name] ?? 'Format invalide.';
    }
    return '';
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
    this.enregistrerCommande();
  }

  /**
   * Enregistre réellement la commande côté serveur, avec ou sans compte (l'API accepte
   * désormais les deux — voir orders.controller.js#create). Un achat sans compte transmet
   * les coordonnées saisies dans `invite` ; le backend recherche automatiquement un compte
   * existant par e-mail avant de créer un accès invité.
   */
  private enregistrerCommande(): void {
    const valeurs = this.checkoutForm.value;
    const adresseLivraison =
      valeurs.typeLivraison === 'retrait'
        ? 'Retrait en magasin'
        : this.commandeContientFournitures
          ? [valeurs.adresseDetaillee, valeurs.delegation, valeurs.gouvernorat]
              .map((v: string) => (v || '').trim()).filter(Boolean).join(', ')
          : '';

    this.derniereCommandeEmail = valeurs.email || this.authService.currentUser?.email || '';

    this.chargementCommande = true;
    this.ordersService
      .create({
        items: this.items.map(i => ({
          titre: i.titre, prix: i.prix, quantite: i.quantite, image: i.icone,
          estDocument: i.estDocument, produitId: i.produitId, categorie: i.categorie,
          type: i.type, auteur: i.auteur, variante: i.variante
        })),
        total: this.total,
        paiement: this.moyenPaiementLabel,
        adresseLivraison,
        gouvernorat: this.commandeContientFournitures ? valeurs.gouvernorat : '',
        delegation: this.commandeContientFournitures ? valeurs.delegation : '',
        commentaire: (valeurs.commentaire || '').trim(),
        invite: this.estConnecte ? undefined : {
          nom: valeurs.nom, prenom: valeurs.prenom, telephone: valeurs.telephone, email: valeurs.email
        }
      })
      .subscribe({
        next: () => {
          this.chargementCommande = false;
          this.montantCommande = this.total;
          this.orderConfirmed = true;
          this.cartService.vider();
        },
        error: err => {
          this.chargementCommande = false;
          this.erreurCommande = err.error?.message || "Erreur lors de l'enregistrement de la commande.";
        }
      });
  }
}
