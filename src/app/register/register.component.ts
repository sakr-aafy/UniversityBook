import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

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

  constructor(private authService: AuthService, private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmation(): void {
    this.showConfirmation = !this.showConfirmation;
  }

  get passwordsMatch(): boolean {
    return this.motDePasse === this.confirmation && this.confirmation.length > 0;
  }

  register(): void {
    this.erreur = '';

    if (!this.nom || !this.email || !this.motDePasse) {
      this.erreur = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (!this.passwordsMatch) {
      this.erreur = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (!this.accepteConditions) {
      this.erreur = "Vous devez accepter les conditions d'utilisation.";
      return;
    }

    this.chargement = true;
    this.authService
      .register({
        nom: this.nom,
        email: this.email,
        telephone: this.telephone,
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
