import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUsersService, AdminUser, AdminUserDetail } from '../../services/admin-users.service';

const REGEX_MOT_DE_PASSE_FORT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { photoUrl } from '../../shared/photo-url.util';

@Component({
  selector: 'app-utilisateurs',
  templateUrl: './utilisateurs.component.html',
  styleUrls: ['./utilisateurs.component.css']
})
export class UtilisateursComponent implements OnInit {
  utilisateurs: AdminUser[] = [];
  chargement: boolean = true;
  erreur: string = '';
  succes: string = '';

  recherche: string = '';
  avecSupprimes: boolean = false;
  page: number = 1;
  totalPages: number = 1;

  // ── Dialogue : détail ──
  dialogDetailOuvert: boolean = false;
  utilisateurDetail: AdminUserDetail | null = null;
  chargementDetail: boolean = false;

  // ── Dialogue : édition ──
  dialogEditionOuvert: boolean = false;
  utilisateurEnEdition: AdminUser | null = null;
  formNom: string = '';
  formPrenom: string = '';
  formEmail: string = '';
  formTelephone: string = '';
  formTelephoneSecondaire: string = '';
  enregistrement: boolean = false;
  erreurEdition: string = '';

  // ── Dialogue : nouvel administrateur ──
  dialogCreationOuvert: boolean = false;
  creationNom: string = '';
  creationPrenom: string = '';
  creationEmail: string = '';
  creationTelephone: string = '';
  creationMotDePasse: string = '';
  creationShowMotDePasse: boolean = false;
  creationEnCours: boolean = false;
  erreurCreation: string = '';

  get creationMotDePasseFort(): boolean {
    return REGEX_MOT_DE_PASSE_FORT.test(this.creationMotDePasse);
  }

  constructor(
    private adminUsersService: AdminUsersService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  photoDe(chemin?: string): string {
    return photoUrl(chemin);
  }

  charger(): void {
    this.chargement = true;
    this.adminUsersService
      .list({ recherche: this.recherche, page: this.page, limite: 10, avecSupprimes: this.avecSupprimes })
      .subscribe({
        next: res => {
          this.utilisateurs = res.utilisateurs;
          this.totalPages = res.totalPages || 1;
          this.chargement = false;
        },
        error: () => {
          this.erreur = 'Impossible de charger les utilisateurs.';
          this.chargement = false;
        }
      });
  }

  rechercher(): void {
    this.page = 1;
    this.charger();
  }

  basculerAvecSupprimes(): void {
    this.avecSupprimes = !this.avecSupprimes;
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

  basculerActif(utilisateur: AdminUser): void {
    this.adminUsersService.toggleActive(utilisateur.id, !utilisateur.actif).subscribe({
      next: res => (utilisateur.actif = res.user.actif),
      error: () => (this.erreur = "Erreur lors de la mise à jour de l'utilisateur.")
    });
  }

  // ══════════════════ Détail ══════════════════

  voir(utilisateur: AdminUser): void {
    this.dialogDetailOuvert = true;
    this.chargementDetail = true;
    this.utilisateurDetail = null;
    this.adminUsersService.getOne(utilisateur.id).subscribe({
      next: detail => {
        this.utilisateurDetail = detail;
        this.chargementDetail = false;
      },
      error: () => {
        this.chargementDetail = false;
        this.dialogDetailOuvert = false;
        this.erreur = "Impossible de charger le détail de l'utilisateur.";
      }
    });
  }

  fermerDetail(): void {
    this.dialogDetailOuvert = false;
  }

  // ══════════════════ Édition ══════════════════

  ouvrirEdition(utilisateur: AdminUser): void {
    this.utilisateurEnEdition = utilisateur;
    this.formNom = utilisateur.nom;
    this.formPrenom = utilisateur.prenom || '';
    this.formEmail = utilisateur.email;
    this.formTelephone = utilisateur.telephone || '';
    this.formTelephoneSecondaire = '';
    this.erreurEdition = '';
    this.dialogEditionOuvert = true;
  }

  fermerEdition(): void {
    this.dialogEditionOuvert = false;
  }

  enregistrerEdition(): void {
    if (!this.utilisateurEnEdition) return;
    this.erreurEdition = '';

    if (!this.formNom.trim() || !this.formEmail.trim()) {
      this.erreurEdition = "Le nom et l'email sont obligatoires.";
      return;
    }

    this.enregistrement = true;
    this.adminUsersService
      .update(this.utilisateurEnEdition.id, {
        nom: this.formNom.trim(),
        prenom: this.formPrenom.trim(),
        email: this.formEmail.trim(),
        telephone: this.formTelephone.trim(),
        telephoneSecondaire: this.formTelephoneSecondaire.trim()
      })
      .subscribe({
        next: res => {
          this.enregistrement = false;
          this.dialogEditionOuvert = false;
          const index = this.utilisateurs.findIndex(u => u.id === res.user.id);
          if (index !== -1) this.utilisateurs[index] = { ...this.utilisateurs[index], ...res.user };
        },
        error: (err: HttpErrorResponse) => {
          this.enregistrement = false;
          this.erreurEdition = err.error?.message || 'Erreur lors de la mise à jour.';
        }
      });
  }

  // ══════════════════ Nouvel administrateur ══════════════════
  // Compte nominatif (profil, adresse, mot de passe modifiables) — distinct du compte système
  // .env, qui n'a aucun profil éditable (voir admin-profil.component.html).

  ouvrirCreation(): void {
    this.creationNom = '';
    this.creationPrenom = '';
    this.creationEmail = '';
    this.creationTelephone = '';
    this.creationMotDePasse = '';
    this.creationShowMotDePasse = false;
    this.erreurCreation = '';
    this.dialogCreationOuvert = true;
  }

  fermerCreation(): void {
    this.dialogCreationOuvert = false;
  }

  toggleCreationMotDePasse(): void {
    this.creationShowMotDePasse = !this.creationShowMotDePasse;
  }

  creerAdmin(): void {
    this.erreurCreation = '';

    if (!this.creationNom.trim() || !this.creationEmail.trim()) {
      this.erreurCreation = "Le nom et l'email sont obligatoires.";
      return;
    }
    if (!this.creationMotDePasseFort) {
      this.erreurCreation = 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';
      return;
    }

    this.creationEnCours = true;
    this.adminUsersService
      .createAdmin({
        nom: this.creationNom.trim(),
        prenom: this.creationPrenom.trim(),
        email: this.creationEmail.trim(),
        telephone: this.creationTelephone.trim(),
        password: this.creationMotDePasse
      })
      .subscribe({
        next: () => {
          this.creationEnCours = false;
          this.dialogCreationOuvert = false;
          this.succes = `Administrateur ${this.creationPrenom} ${this.creationNom} créé avec succès.`;
          setTimeout(() => (this.succes = ''), 5000);
          this.charger();
        },
        error: (err: HttpErrorResponse) => {
          this.creationEnCours = false;
          this.erreurCreation = err.error?.message || "Erreur lors de la création de l'administrateur.";
        }
      });
  }

  // ══════════════════ Suppression ══════════════════

  async supprimer(utilisateur: AdminUser): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Confirmation de suppression',
      message: `Supprimer ${utilisateur.prenom} ${utilisateur.nom} ? Cette action peut être annulée en réactivant le compte plus tard.`,
      icone: 'fa-triangle-exclamation',
      variante: 'danger',
      labelConfirmer: 'Supprimer'
    });
    if (!confirme) return;

    this.erreur = '';
    this.adminUsersService.remove(utilisateur.id).subscribe({
      next: () => {
        this.succes = `${utilisateur.prenom} ${utilisateur.nom} a été supprimé.`;
        setTimeout(() => (this.succes = ''), 5000);
        this.charger();
      },
      error: () => (this.erreur = "Erreur lors de la suppression de l'utilisateur.")
    });
  }

  trackById(_index: number, item: AdminUser): string {
    return item.id;
  }
}
