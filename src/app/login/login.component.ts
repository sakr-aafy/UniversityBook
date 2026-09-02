import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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

  // ── Étape 2 de la connexion : vérification par code OTP envoyé par e-mail ──
  otpRequis        = false;
  otpSession       = '';
  otpCode          = '';
  otpErreur        = '';
  otpChargement    = false;
  otpResendCooldown = 0;
  private otpCooldownInterval: ReturnType<typeof setInterval> | null = null;

  // ── Modale "mot de passe oublié" ──
  showForgotModal    = false;
  forgotStep: 1 | 2 | 3 = 1;          // 1 = email, 2 = OTP, 3 = nouveau mot de passe
  forgotEmail        = '';
  forgotEmailTouched = false;
  forgotLoading      = false;
  forgotError        = '';

  forgotOtpInput          = '';
  forgotOtpTouched        = false;
  forgotOtpVerifyLoading  = false;
  forgotOtpError          = '';
  forgotOtpResendCooldown = 0;
  forgotResetToken        = '';
  private forgotCooldownInterval: ReturnType<typeof setInterval> | null = null;

  forgotNewPassword           = '';
  forgotNewPasswordTouched    = false;
  forgotShowNewPassword       = false;
  forgotConfirmPassword       = '';
  forgotConfirmPasswordTouched = false;
  forgotResetLoading           = false;
  forgotResetError             = '';
  forgotResetSuccess           = false;

  /** Destination après connexion réussie si fournie en query param (ex. depuis le panier :
   *  /login?returnUrl=/panier?checkout=1). Doit être un chemin interne ("/…") — sinon ignorée. */
  private returnUrl: string | null = null;

  constructor(private authService: AuthService, private router: Router, route: ActivatedRoute) {
    // Redirection déclenchée par l'intercepteur HTTP quand le jeton stocké a été rejeté (401) —
    // voir auth.interceptor.ts. On informe l'utilisateur plutôt que de le renvoyer ici sans
    // explication.
    if (route.snapshot.queryParamMap.get('sessionExpiree') === '1') {
      this.erreur = 'Votre session a expiré. Veuillez vous reconnecter.';
    }
    const retour = route.snapshot.queryParamMap.get('returnUrl');
    if (retour && retour.startsWith('/')) this.returnUrl = retour;
  }

  /** Redirige vers `returnUrl` s'il a été fourni, sinon vers l'espace de l'utilisateur. */
  private redirigerApresConnexion(): void {
    this.router.navigateByUrl(this.returnUrl || this.authService.espaceUrl);
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  private isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // ═══════════════════════════════════
  // CONNEXION
  // ═══════════════════════════════════
  login(): void {
    this.erreur = '';

    if (!this.identifiant || !this.motDePasse) {
      this.erreur = 'Veuillez saisir votre email (ou téléphone) et votre mot de passe.';
      return;
    }

    this.chargement = true;
    this.authService.login({ identifiant: this.identifiant, motDePasse: this.motDePasse }).subscribe({
      next: res => {
        this.chargement = false;
        if (res.otpRequired) {
          this.otpRequis  = true;
          this.otpSession = res.otpSession || '';
          this.otpCode    = '';
          this.otpErreur  = '';
          this.startOtpCooldown();
        } else {
          this.redirigerApresConnexion();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.chargement = false;
        this.erreur = err.error?.message || 'Une erreur est survenue lors de la connexion.';
      }
    });
  }

  /** Retour à l'étape identifiant/mot de passe (avant l'envoi du code) */
  annulerOtpLogin(): void {
    this.otpRequis = false;
    this.otpCode   = '';
    this.otpErreur = '';
    this.stopOtpCooldown();
  }

  /** Vérifie le code OTP de connexion reçu par e-mail */
  verifierOtpLogin(): void {
    this.otpErreur = '';
    if (!/^\d{6}$/.test(this.otpCode)) {
      this.otpErreur = 'Le code doit contenir 6 chiffres.';
      return;
    }

    this.otpChargement = true;
    this.authService.verifierOtpConnexion(this.otpSession, this.otpCode).subscribe({
      next: () => {
        this.otpChargement = false;
        this.stopOtpCooldown();
        this.redirigerApresConnexion();
      },
      error: (err: HttpErrorResponse) => {
        this.otpChargement = false;
        this.otpErreur = err.error?.message || 'Code incorrect ou expiré.';
      }
    });
  }

  /** Redemande un code OTP de connexion (relance login() avec les mêmes identifiants) */
  renvoyerOtpLogin(): void {
    if (this.otpResendCooldown > 0) return;
    this.otpErreur = '';
    this.authService.login({ identifiant: this.identifiant, motDePasse: this.motDePasse }).subscribe({
      next: res => {
        if (res.otpRequired) {
          this.otpSession = res.otpSession || '';
          this.otpCode    = '';
          this.startOtpCooldown();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.otpErreur = err.error?.message || "Erreur lors de l'envoi du code.";
      }
    });
  }

  private startOtpCooldown(): void {
    this.stopOtpCooldown();
    this.otpResendCooldown = 60;
    this.otpCooldownInterval = setInterval(() => {
      this.otpResendCooldown--;
      if (this.otpResendCooldown <= 0) this.stopOtpCooldown();
    }, 1000);
  }

  stopOtpCooldown(): void {
    if (this.otpCooldownInterval) {
      clearInterval(this.otpCooldownInterval);
      this.otpCooldownInterval = null;
    }
    this.otpResendCooldown = 0;
  }

  // ═══════════════════════════════════
  // MODALE MOT DE PASSE OUBLIÉ
  // ═══════════════════════════════════

  openForgotModal(): void {
    this.showForgotModal    = true;
    this.forgotStep         = 1;
    this.forgotEmail        = '';
    this.forgotEmailTouched = false;
    this.forgotError        = '';
    this.forgotLoading      = false;

    this.forgotOtpInput   = '';
    this.forgotOtpTouched = false;
    this.forgotOtpError   = '';
    this.forgotResetToken = '';

    this.forgotNewPassword           = '';
    this.forgotNewPasswordTouched    = false;
    this.forgotShowNewPassword       = false;
    this.forgotConfirmPassword       = '';
    this.forgotConfirmPasswordTouched = false;
    this.forgotResetError             = '';
    this.forgotResetLoading           = false;
    this.forgotResetSuccess           = false;

    this.stopForgotCooldown();
  }

  closeForgotModal(): void {
    this.showForgotModal = false;
    this.stopForgotCooldown();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeForgotModal();
    }
  }

  // ── Étape 1 : email ──
  get forgotEmailError(): string {
    if (!this.forgotEmailTouched) return '';
    if (!this.forgotEmail.trim()) return "L'adresse email est obligatoire.";
    if (!this.isValidEmail(this.forgotEmail)) return 'Veuillez saisir un email valide.';
    return '';
  }

  get isForgotEmailValid(): boolean {
    return this.isValidEmail(this.forgotEmail);
  }

  onForgotEmailBlur(): void { this.forgotEmailTouched = true; }

  onSendForgotOtp(): void {
    this.forgotEmailTouched = true;
    this.forgotError        = '';
    if (!this.isForgotEmailValid) return;

    this.forgotLoading = true;
    this.authService.demanderOtp(this.forgotEmail).subscribe(error => {
      this.forgotLoading = false;
      if (error) {
        this.forgotError = error;
        return;
      }
      this.forgotStep       = 2;
      this.forgotOtpInput   = '';
      this.forgotOtpTouched = false;
      this.forgotOtpError   = '';
      this.startForgotCooldown();
    });
  }

  // ── Étape 2 : OTP ──
  get forgotOtpErrorMsg(): string {
    if (!this.forgotOtpTouched) return '';
    if (!this.forgotOtpInput.trim()) return 'Veuillez saisir le code reçu.';
    if (!/^\d{6}$/.test(this.forgotOtpInput)) return 'Le code doit contenir 6 chiffres.';
    return '';
  }

  onForgotOtpBlur(): void { this.forgotOtpTouched = true; }

  onVerifyForgotOtp(): void {
    this.forgotOtpTouched = true;
    this.forgotOtpError   = '';
    if (!/^\d{6}$/.test(this.forgotOtpInput)) return;

    this.forgotOtpVerifyLoading = true;
    this.authService.verifierOtp(this.forgotEmail, this.forgotOtpInput.trim()).subscribe(({ resetToken, error }) => {
      this.forgotOtpVerifyLoading = false;
      if (error || !resetToken) {
        this.forgotOtpError = error || 'Code incorrect ou expiré.';
        return;
      }
      this.forgotResetToken = resetToken;
      this.stopForgotCooldown();
      this.forgotStep = 3;
    });
  }

  resendForgotOtp(): void {
    if (this.forgotOtpResendCooldown > 0) return;
    this.authService.demanderOtp(this.forgotEmail).subscribe(error => {
      if (error) { this.forgotOtpError = error; return; }
      this.forgotOtpInput   = '';
      this.forgotOtpTouched = false;
      this.forgotOtpError   = '';
      this.startForgotCooldown();
    });
  }

  // ── Étape 3 : nouveau mot de passe ──
  get forgotNewPasswordError(): string {
    if (!this.forgotNewPasswordTouched) return '';
    if (!this.forgotNewPassword) return 'Le mot de passe est obligatoire.';
    if (this.forgotNewPassword.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
    return '';
  }

  get forgotConfirmPasswordError(): string {
    if (!this.forgotConfirmPasswordTouched) return '';
    if (!this.forgotConfirmPassword) return 'Veuillez confirmer le mot de passe.';
    if (this.forgotConfirmPassword !== this.forgotNewPassword) return 'Les mots de passe ne correspondent pas.';
    return '';
  }

  get isForgotResetFormValid(): boolean {
    return this.forgotNewPassword.length >= 6 && this.forgotConfirmPassword === this.forgotNewPassword;
  }

  onForgotNewPasswordBlur(): void     { this.forgotNewPasswordTouched = true; }
  onForgotConfirmPasswordBlur(): void { this.forgotConfirmPasswordTouched = true; }
  toggleForgotNewPassword(): void     { this.forgotShowNewPassword = !this.forgotShowNewPassword; }

  onResetForgotPassword(): void {
    this.forgotNewPasswordTouched     = true;
    this.forgotConfirmPasswordTouched = true;
    this.forgotResetError             = '';
    if (!this.isForgotResetFormValid) return;

    this.forgotResetLoading = true;
    this.authService.reinitialiserMotDePasse(this.forgotEmail, this.forgotResetToken, this.forgotNewPassword).subscribe(error => {
      this.forgotResetLoading = false;
      if (error) {
        this.forgotResetError = error;
        return;
      }
      this.forgotResetSuccess = true;
      setTimeout(() => this.closeForgotModal(), 2500);
    });
  }

  private startForgotCooldown(): void {
    this.stopForgotCooldown();
    this.forgotOtpResendCooldown = 60;
    this.forgotCooldownInterval = setInterval(() => {
      this.forgotOtpResendCooldown--;
      if (this.forgotOtpResendCooldown <= 0) this.stopForgotCooldown();
    }, 1000);
  }

  stopForgotCooldown(): void {
    if (this.forgotCooldownInterval) {
      clearInterval(this.forgotCooldownInterval);
      this.forgotCooldownInterval = null;
    }
    this.forgotOtpResendCooldown = 0;
  }
}
