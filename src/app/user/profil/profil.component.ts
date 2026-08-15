import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { UserService, UserProfile, Adresse, DashboardStats, ActiviteItem, TypeActivite } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { photoUrl } from '../../shared/photo-url.util';
import { GOUVERNORATS_TUNISIE, delegationsPourGouvernorat } from '../../shared/tunisie-geo.data';

const REGEX_MOT_DE_PASSE_FORT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Seuil purement présentatif (badge) — aucun système d'abonnement réel dans l'application. */
const SEUIL_CLIENT_PREMIUM_DT = 200;

const ADRESSE_VIDE: Adresse = {
  libelle: '',
  ligne1: '',
  ligne2: '',
  ville: '',
  gouvernorat: '',
  delegation: '',
  codePostal: '',
  pays: 'Tunisie',
  parDefaut: false
};

const ICONES_ACTIVITE: Record<TypeActivite, string> = {
  connexion: 'fa-right-to-bracket',
  commande: 'fa-bag-shopping',
  telechargement: 'fa-download',
  paiement: 'fa-wallet',
  profil: 'fa-user-pen'
};

const COULEURS_ACTIVITE: Record<TypeActivite, { fond: string; couleur: string }> = {
  connexion: { fond: '#EFF6FF', couleur: '#2563EB' },
  commande: { fond: '#FDF2F3', couleur: '#8C2433' },
  telechargement: { fond: '#ECFDF5', couleur: '#16A34A' },
  paiement: { fond: '#FFFBEB', couleur: '#B45309' },
  profil: { fond: '#F5F3FF', couleur: '#7C3AED' }
};

@Component({
  selector: 'app-profil',
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.css']
})
export class ProfilComponent implements OnInit {
  chargement: boolean = true;
  erreur: string = '';

  profil: UserProfile | null = null;
  stats: DashboardStats | null = null;

  // ── Dialogue : informations personnelles ──
  dialogInfosOuvert: boolean = false;
  enregistrement: boolean = false;
  erreurInfos: string = '';
  nom: string = '';
  prenom: string = '';
  email: string = '';
  telephone: string = '';
  telephoneSecondaire: string = '';
  dateNaissance: string = '';
  genre: string = '';
  photoApercu: string | null = null;
  photoFichier: File | null = null;

  // ── Dialogue : mot de passe ──
  dialogMotDePasseOuvert: boolean = false;
  ancienMotDePasse: string = '';
  nouveauMotDePasse: string = '';
  confirmationMotDePasse: string = '';
  showAncien: boolean = false;
  showNouveau: boolean = false;
  showConfirmation: boolean = false;
  chargementMotDePasse: boolean = false;
  erreurMotDePasse: string = '';
  succesMotDePasse: string = '';

  // ── Dialogue : adresse ──
  dialogAdresseOuvert: boolean = false;
  adresseEnEdition: Adresse = { ...ADRESSE_VIDE };
  chargementAdresse: boolean = false;
  erreurAdresse: string = '';
  readonly gouvernorats: string[] = GOUVERNORATS_TUNISIE.map(g => g.nom);
  delegationsDisponibles: string[] = [];

  // ── Historique d'activité ──
  activites: ActiviteItem[] = [];
  chargementActivites: boolean = true;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  get photoActuelleUrl(): string {
    return photoUrl(this.photoApercu || this.profil?.photo);
  }

  get motDePasseFort(): boolean {
    return REGEX_MOT_DE_PASSE_FORT.test(this.nouveauMotDePasse);
  }

  get motsDePasseCorrespondent(): boolean {
    return !!this.confirmationMotDePasse && this.nouveauMotDePasse === this.confirmationMotDePasse;
  }

  get adresses(): Adresse[] {
    return this.profil?.adresses || [];
  }

  /** Badge purement présentatif : aucun véritable système d'abonnement Premium dans l'application. */
  get estClientPremium(): boolean {
    return (this.stats?.totalAchats || 0) >= SEUIL_CLIENT_PREMIUM_DT;
  }

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    forkJoin({
      profil: this.userService.getProfile(),
      dashboard: this.userService.getDashboard()
    }).subscribe({
      next: ({ profil, dashboard }) => {
        this.profil = profil;
        this.stats = dashboard.stats;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger votre profil.';
        this.chargement = false;
      }
    });

    this.chargementActivites = true;
    this.userService.getActivites().subscribe({
      next: activites => {
        this.activites = activites;
        this.chargementActivites = false;
      },
      error: () => {
        this.chargementActivites = false;
      }
    });
  }

  iconeActivite(type: TypeActivite): string {
    return ICONES_ACTIVITE[type] || 'fa-circle';
  }

  couleurActivite(type: TypeActivite): { fond: string; couleur: string } {
    return COULEURS_ACTIVITE[type] || { fond: '#F0F1F4', couleur: '#3C444E' };
  }

  // ══════════════════ Informations personnelles ══════════════════

  ouvrirDialogInfos(): void {
    if (!this.profil) return;
    this.nom = this.profil.nom;
    this.prenom = this.profil.prenom || '';
    this.email = this.profil.email;
    this.telephone = this.profil.telephone || '';
    this.telephoneSecondaire = this.profil.telephoneSecondaire || '';
    this.dateNaissance = this.profil.dateNaissance ? this.profil.dateNaissance.substring(0, 10) : '';
    this.genre = this.profil.genre || '';
    this.photoApercu = null;
    this.photoFichier = null;
    this.erreurInfos = '';
    this.dialogInfosOuvert = true;
  }

  fermerDialogInfos(): void {
    this.dialogInfosOuvert = false;
  }

  onPhotoSelectionnee(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    if (!fichier) return;

    this.photoFichier = fichier;
    const lecteur = new FileReader();
    lecteur.onload = () => (this.photoApercu = lecteur.result as string);
    lecteur.readAsDataURL(fichier);
  }

  enregistrerInfos(): void {
    this.erreurInfos = '';

    if (!this.nom.trim() || !this.email.trim()) {
      this.erreurInfos = "Le nom et l'email sont obligatoires.";
      return;
    }
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    if (!emailValide) {
      this.erreurInfos = 'Veuillez saisir une adresse email valide.';
      return;
    }

    this.enregistrement = true;
    this.userService
      .updateProfile(
        {
          nom: this.nom.trim(),
          prenom: this.prenom.trim(),
          email: this.email.trim(),
          telephone: this.telephone.trim(),
          telephoneSecondaire: this.telephoneSecondaire.trim(),
          dateNaissance: this.dateNaissance || undefined,
          genre: this.genre || undefined
        },
        this.photoFichier
      )
      .subscribe({
        next: res => {
          this.enregistrement = false;
          this.profil = res.user;
          this.dialogInfosOuvert = false;
          this.authService.patchCurrentUser({
            nom: res.user.nom,
            prenom: res.user.prenom,
            email: res.user.email,
            telephone: res.user.telephone,
            photo: res.user.photo
          });
        },
        error: (err: HttpErrorResponse) => {
          this.enregistrement = false;
          this.erreurInfos = err.error?.message || 'Erreur lors de la mise à jour du profil.';
        }
      });
  }

  // ══════════════════ Mot de passe ══════════════════

  ouvrirDialogMotDePasse(): void {
    this.ancienMotDePasse = '';
    this.nouveauMotDePasse = '';
    this.confirmationMotDePasse = '';
    this.erreurMotDePasse = '';
    this.succesMotDePasse = '';
    this.dialogMotDePasseOuvert = true;
  }

  fermerDialogMotDePasse(): void {
    this.dialogMotDePasseOuvert = false;
  }

  changerMotDePasse(): void {
    this.erreurMotDePasse = '';
    this.succesMotDePasse = '';

    if (!this.ancienMotDePasse || !this.nouveauMotDePasse || !this.confirmationMotDePasse) {
      this.erreurMotDePasse = 'Tous les champs sont requis.';
      return;
    }
    if (!this.motDePasseFort) {
      this.erreurMotDePasse = 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';
      return;
    }
    if (!this.motsDePasseCorrespondent) {
      this.erreurMotDePasse = 'La confirmation ne correspond pas au nouveau mot de passe.';
      return;
    }

    this.chargementMotDePasse = true;
    this.userService.changePassword({
      ancienMotDePasse: this.ancienMotDePasse,
      nouveauMotDePasse: this.nouveauMotDePasse,
      confirmation: this.confirmationMotDePasse
    }).subscribe({
      next: res => {
        this.chargementMotDePasse = false;
        this.succesMotDePasse = res.message;
        this.ancienMotDePasse = '';
        this.nouveauMotDePasse = '';
        this.confirmationMotDePasse = '';
      },
      error: (err: HttpErrorResponse) => {
        this.chargementMotDePasse = false;
        this.erreurMotDePasse = err.error?.message || 'Erreur lors du changement de mot de passe.';
      }
    });
  }

  // ══════════════════ Adresses ══════════════════

  ouvrirAjoutAdresse(): void {
    this.adresseEnEdition = { ...ADRESSE_VIDE };
    this.delegationsDisponibles = [];
    this.erreurAdresse = '';
    this.dialogAdresseOuvert = true;
  }

  ouvrirEditionAdresse(adresse: Adresse): void {
    this.adresseEnEdition = { ...adresse };
    this.delegationsDisponibles = delegationsPourGouvernorat(adresse.gouvernorat);
    this.erreurAdresse = '';
    this.dialogAdresseOuvert = true;
  }

  onGouvernoratAdresseChange(gouvernorat: string): void {
    this.adresseEnEdition.gouvernorat = gouvernorat;
    this.delegationsDisponibles = delegationsPourGouvernorat(gouvernorat);
    if (!this.delegationsDisponibles.includes(this.adresseEnEdition.delegation || '')) {
      this.adresseEnEdition.delegation = '';
    }
  }

  fermerDialogAdresse(): void {
    this.dialogAdresseOuvert = false;
  }

  enregistrerAdresse(): void {
    this.erreurAdresse = '';
    if (!this.adresseEnEdition.ligne1.trim()) {
      this.erreurAdresse = "L'adresse est obligatoire.";
      return;
    }

    this.chargementAdresse = true;
    const obs = this.adresseEnEdition._id
      ? this.userService.updateAdresse(this.adresseEnEdition._id, this.adresseEnEdition)
      : this.userService.addAdresse(this.adresseEnEdition);

    obs.subscribe({
      next: res => {
        this.chargementAdresse = false;
        this.dialogAdresseOuvert = false;
        if (this.profil) this.profil = { ...this.profil, adresses: res.adresses };
      },
      error: (err: HttpErrorResponse) => {
        this.chargementAdresse = false;
        this.erreurAdresse = err.error?.message || "Erreur lors de l'enregistrement de l'adresse.";
      }
    });
  }

  definirParDefaut(adresse: Adresse): void {
    if (!adresse._id || adresse.parDefaut) return;
    this.userService.updateAdresse(adresse._id, { ...adresse, parDefaut: true }).subscribe({
      next: res => {
        if (this.profil) this.profil = { ...this.profil, adresses: res.adresses };
      }
    });
  }

  async supprimerAdresse(adresse: Adresse): Promise<void> {
    if (!adresse._id) return;
    const confirme = await this.confirmDialogService.confirmer({
      titre: "Supprimer l'adresse",
      message: `Voulez-vous vraiment supprimer l'adresse « ${adresse.libelle || adresse.ligne1} » ?`,
      icone: 'fa-trash-can',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.userService.deleteAdresse(adresse._id).subscribe({
      next: res => {
        if (this.profil) this.profil = { ...this.profil, adresses: res.adresses };
      }
    });
  }

  trackByAdresseId(_index: number, item: Adresse): string {
    return item._id || item.ligne1;
  }
}
