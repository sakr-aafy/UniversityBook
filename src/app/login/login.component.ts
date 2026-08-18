import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  identifiant: string = '';
  motDePasse: string = '';
  souvenir: boolean = false;
  showPassword: boolean = false;

  chargement: boolean = false;
  erreur: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.erreur = '';

    if (!this.identifiant || !this.motDePasse) {
      this.erreur = 'Veuillez saisir votre email (ou téléphone) et votre mot de passe.';
      return;
    }

    this.chargement = true;
    this.authService.login({ identifiant: this.identifiant, motDePasse: this.motDePasse }).subscribe({
      next: () => {
        this.chargement = false;
        this.router.navigate([this.authService.espaceUrl]);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement = false;
        this.erreur = err.error?.message || 'Une erreur est survenue lors de la connexion.';
      }
    });
  }
}
