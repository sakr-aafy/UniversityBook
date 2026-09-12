import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

/** Lettres (accents compris), espaces, apostrophes et tirets — même règle que
 *  panier.component.ts#NOM_PATTERN pour le nom complet. */
const NOM_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Numéro tunisien local à 8 chiffres — même règle que login/panier (checkoutForm#telephone). */
const TELEPHONE_PATTERN = /^[0-9]{8}$/;

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  nom: string = '';
  email: string = '';
  telephone: string = '';
  motDePasse: string = '';
  confirmation: string = '';
  accepteConditions: boolean = false;
  showPassword: boolean = false;
  showConfirmation: boolean = false;

  chargement: boolean = false;
  erreur: string = '';

  // ── Suivi "champ visité" par champ — conditionne l'affichage des erreurs (jamais avant que
  // l'utilisateur n'ait quitté le champ, ni à l'ouverture du formulaire). `submitted` force
  // l'affichage de tous les champs restés vierges lors d'une tentative de soumission invalide. ──
  nomTouche = false;
  emailTouche = false;
  telephoneTouche = false;
  motDePasseTouche = false;
  confirmationTouche = false;
  submitted = false;

  constructor(private authService: AuthService, private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmation(): void {
    this.showConfirmation = !this.showConfirmation;
  }

  onNomBlur(): void { this.nomTouche = true; }
  onEmailBlur(): void { this.emailTouche = true; }
  onTelephoneBlur(): void { this.telephoneTouche = true; }
  onMotDePasseBlur(): void { this.motDePasseTouche = true; }
  onConfirmationBlur(): void { this.confirmationTouche = true; }

  get passwordsMatch(): boolean {
    return this.motDePasse === this.confirmation && this.confirmation.length > 0;
  }

  get isNomValide(): boolean {
    const v = this.nom.trim();
    return v.length >= 2 && NOM_PATTERN.test(v);
  }
  get nomErreur(): string {
    if (!this.nomTouche && !this.submitted) return '';
    if (!this.nom.trim()) return 'Le nom complet est obligatoire.';
    if (!NOM_PATTERN.test(this.nom.trim())) return 'Seules les lettres sont autorisées.';
    if (this.nom.trim().length < 2) return 'Minimum 2 caractères requis.';
    return '';
  }

  get isEmailValide(): boolean {
    return EMAIL_PATTERN.test(this.email.trim());
  }
  get emailErreur(): string {
    if (!this.emailTouche && !this.submitted) return '';
    if (!this.email.trim()) return "L'adresse e-mail est obligatoire.";
    if (!this.isEmailValide) return 'Veuillez saisir un e-mail valide.';
    return '';
  }

  /** Téléphone obligatoire — numéro tunisien local à 8 chiffres (ex : 22 345 678). */
  get isTelephoneValide(): boolean {
    return TELEPHONE_PATTERN.test(this.telephone.trim());
  }
  get telephoneErreur(): string {
    if (!this.telephoneTouche && !this.submitted) return '';
    if (!this.telephone.trim()) return 'Le numéro de téléphone est obligatoire.';
    if (!this.isTelephoneValide) return 'Numéro à 8 chiffres requis (ex : 22 345 678).';
    return '';
  }

  /** Filtre en temps réel (en plus de la validation) : n'accepte que des chiffres, 8 max —
   *  même convention que panier.component.ts#filtrerChiffres. */
  onTelephoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chiffres = input.value.replace(/\D/g, '').slice(0, 8);
    this.telephone = chiffres;
    input.value = chiffres;
  }

  get isMotDePasseValide(): boolean {
    return this.motDePasse.length >= 6;
  }
  get motDePasseErreur(): string {
    if (!this.motDePasseTouche && !this.submitted) return '';
    if (!this.motDePasse) return 'Le mot de passe est obligatoire.';
    if (!this.isMotDePasseValide) return 'Minimum 6 caractères requis.';
    return '';
  }

  get confirmationErreur(): string {
    if (!this.confirmationTouche && !this.submitted) return '';
    if (!this.confirmation) return 'Veuillez confirmer le mot de passe.';
    if (!this.passwordsMatch) return 'Les mots de passe ne correspondent pas.';
    return '';
  }

  get formulaireValide(): boolean {
    return this.isNomValide && this.isEmailValide && this.isTelephoneValide
      && this.isMotDePasseValide && this.passwordsMatch && this.accepteConditions;
  }

  register(): void {
    this.erreur = '';
    this.submitted = true;

    if (!this.formulaireValide) {
      if (!this.accepteConditions) {
        this.erreur = "Vous devez accepter les conditions d'utilisation.";
      }
      return;
    }

    this.chargement = true;
    this.authService
      .register({
        nom: this.nom.trim(),
        email: this.email.trim(),
        telephone: this.telephone.trim(),
        motDePasse: this.motDePasse
      })
      .subscribe({
        next: () => {
          this.chargement = false;
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          this.chargement = false;
          this.erreur = err.error?.message || "Une erreur est survenue lors de l'inscription.";
        }
      });
  }
}
