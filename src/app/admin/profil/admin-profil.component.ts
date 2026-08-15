import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminProfilService,
  AdminProfil
} from '../../services/admin-profil.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { GOUVERNORATS_TUNISIE, delegationsPourGouvernorat } from '../../shared/tunisie-geo.data';
import { photoUrl } from '../../shared/photo-url.util';

const REGEX_MOT_DE_PASSE_FORT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

@Component({
  selector: 'app-admin-profil',
  templateUrl: './admin-profil.component.html',
  styleUrls: ['./admin-profil.component.css']
})
export class AdminProfilComponent implements OnInit {
  chargement: boolean = true;
  erreur: string = '';

  profil: AdminProfil | null = null;

  // ── Dialogue : informations personnelles ──
  dialogInfosOuvert: boolean = false;
  enregistrement: boolean = false;
  erreurInfos: string = '';
  nom: string = '';
  prenom: string = '';
  email: string = '';
  telephone: string = '';
  photoApercu: string | null = null;
  photoFichier: File | null = null;

  // ── Dialogue : adresse ──
  dialogAdresseOuvert: boolean = false;
  chargementAdresse: boolean = false;
  erreurAdresse: string = '';
  readonly gouvernorats: string[] = GOUVERNORATS_TUNISIE.map(g => g.nom);
  delegationsDisponibles: string[] = [];
  formGouvernorat: string = '';
  formDelegation: string = '';
  formCodePostal: string = '';
  formAdresseDetaillee: string = '';

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

  constructor(
    private adminProfilService: AdminProfilService,
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

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.adminProfilService.getMonProfil().subscribe({
      next: profil => {
        this.profil = profil;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger le profil.';
        this.chargement = false;
      }
    });
  }

  // ══════════════════ Informations personnelles ══════════════════

  ouvrirDialogInfos(): void {
    if (!this.profil) return;
    this.nom = this.profil.nom;
    this.prenom = this.profil.prenom || '';
    this.email = this.profil.email;
    this.telephone = this.profil.telephone || '';
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

  async enregistrerInfos(): Promise<void> {
    this.erreurInfos = '';

    if (!this.nom.trim() || !this.email.trim()) {
      this.erreurInfos = "Le nom et l'email sont obligatoires.";
      return;
    }

    // Le changement d'e-mail est un geste sensible : confirmation explicite avant envoi
    // (le contrôle d'unicité, lui, est fait côté serveur — même pattern que le profil client).
    const emailModifie = this.email.trim().toLowerCase() !== (this.profil?.email || '').toLowerCase();
    if (emailModifie) {
      const confirme = await this.confirmDialogService.confirmer({
        titre: "Confirmation de changement d'e-mail",
        message: `Vous êtes sur le point de changer votre adresse e-mail vers « ${this.email.trim()} ». Confirmer ?`,
        icone: 'fa-envelope',
        labelConfirmer: 'Confirmer'
      });
      if (!confirme) return;
    }

    this.enregistrement = true;
    this.adminProfilService
      .updateMonProfil(
        { nom: this.nom.trim(), prenom: this.prenom.trim(), email: this.email.trim(), telephone: this.telephone.trim() },
        this.photoFichier
      )
      .subscribe({
        next: res => {
          this.enregistrement = false;
          this.profil = res.profil;
          this.dialogInfosOuvert = false;
        },
        error: (err: HttpErrorResponse) => {
          this.enregistrement = false;
          this.erreurInfos = err.error?.message || 'Erreur lors de la mise à jour du profil.';
        }
      });
  }

  // ══════════════════ Adresse ══════════════════

  ouvrirDialogAdresse(): void {
    if (!this.profil) return;
    this.formGouvernorat = this.profil.adresse?.gouvernorat || '';
    this.formDelegation = this.profil.adresse?.delegation || '';
    this.formCodePostal = this.profil.adresse?.codePostal || '';
    this.formAdresseDetaillee = this.profil.adresse?.ligne1 || '';
    this.delegationsDisponibles = delegationsPourGouvernorat(this.formGouvernorat);
    this.erreurAdresse = '';
    this.dialogAdresseOuvert = true;
  }

  fermerDialogAdresse(): void {
    this.dialogAdresseOuvert = false;
  }

  onGouvernoratChange(gouvernorat: string): void {
    this.formGouvernorat = gouvernorat;
    this.delegationsDisponibles = delegationsPourGouvernorat(gouvernorat);
    if (!this.delegationsDisponibles.includes(this.formDelegation)) {
      this.formDelegation = '';
    }
  }

  enregistrerAdresse(): void {
    this.erreurAdresse = '';
    if (!this.formAdresseDetaillee.trim()) {
      this.erreurAdresse = "L'adresse détaillée est requise.";
      return;
    }

    this.chargementAdresse = true;
    this.adminProfilService
      .updateMonAdresse({
        gouvernorat: this.formGouvernorat,
        delegation: this.formDelegation,
        codePostal: this.formCodePostal,
        adresse: this.formAdresseDetaillee.trim()
      })
      .subscribe({
        next: res => {
          this.chargementAdresse = false;
          this.dialogAdresseOuvert = false;
          if (this.profil) this.profil = { ...this.profil, adresse: res.adresse };
        },
        error: (err: HttpErrorResponse) => {
          this.chargementAdresse = false;
          this.erreurAdresse = err.error?.message || "Erreur lors de la mise à jour de l'adresse.";
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
    this.adminProfilService
      .changerMonMotDePasse({
        ancienMotDePasse: this.ancienMotDePasse,
        nouveauMotDePasse: this.nouveauMotDePasse,
        confirmation: this.confirmationMotDePasse
      })
      .subscribe({
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
}
