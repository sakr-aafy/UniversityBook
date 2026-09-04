import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RegisterPayload {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  motDePasse: string;
}

export interface LoginPayload {
  /** Email OU numéro de téléphone — accepte aussi les identifiants carte fidélité (client
   *  créé/importé côté caisse, voir auth.controller.js#login). */
  identifiant: string;
  motDePasse: string;
}

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  photo?: string;
  role: UserRole;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

/**
 * Réponse de POST /auth/login : la connexion nécessite désormais toujours une vérification par
 * code OTP envoyé par e-mail (voir auth.controller.js#login/verifierOtpConnexion), sauf pour les
 * rares comptes sans e-mail réel (client caisse sans adresse) où `otpRequired` est false et le
 * jeton est déjà fourni.
 */
export interface LoginResult {
  otpRequired: boolean;
  message: string;
  otpSession?: string;
  token?: string;
  user?: AuthUser;
}

const TOKEN_KEY = 'ub_token';
const USER_KEY = 'ub_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.lireUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, payload)
      .pipe(tap(res => this.stocker(res)));
  }

  login(payload: LoginPayload): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.apiUrl}/login`, payload).pipe(
      tap(res => { if (!res.otpRequired && res.token && res.user) this.stocker(res as AuthResponse); })
    );
  }

  /**
   * "Continuer avec Google" (POST /auth/google) : `credential` est le jeton d'identité (JWT)
   * fourni par Google Identity Services côté client (voir login.component.ts) — vérifié côté
   * serveur (auth.controller.js#loginGoogle) avant toute connexion/création de compte. Pas
   * d'étape OTP supplémentaire, contrairement à login() : la réponse contient toujours
   * directement le jeton final.
   */
  loginWithGoogle(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/google`, { credential })
      .pipe(tap(res => this.stocker(res)));
  }

  /** Étape 2 de la connexion : vérifie le code OTP reçu par e-mail (POST /auth/verifier-otp-connexion). */
  verifierOtpConnexion(otpSession: string, code: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/verifier-otp-connexion`, { otpSession, code })
      .pipe(tap(res => this.stocker(res)));
  }

  /** "Mot de passe oublié" — étape 1 : demande l'envoi d'un code OTP par e-mail. */
  demanderOtp(email: string): Observable<string | null> {
    return this.http.post(`${this.apiUrl}/mot-de-passe-oublie`, { email }).pipe(
      map(() => null),
      catchError(err => of(err.error?.message || "Erreur lors de l'envoi du code."))
    );
  }

  /** "Mot de passe oublié" — étape 2 : vérifie le code OTP saisi, renvoie un jeton de réinitialisation. */
  verifierOtp(email: string, code: string): Observable<{ resetToken: string | null; error: string | null }> {
    return this.http.post<{ resetToken: string }>(`${this.apiUrl}/mot-de-passe-oublie/verifier`, { email, code }).pipe(
      map(res => ({ resetToken: res.resetToken, error: null })),
      catchError(err => of({ resetToken: null, error: err.error?.message || 'Code incorrect ou expiré.' }))
    );
  }

  /** "Mot de passe oublié" — étape 3 : applique le nouveau mot de passe. */
  reinitialiserMotDePasse(email: string, resetToken: string, nouveauMotDePasse: string): Observable<string | null> {
    return this.http.post(`${this.apiUrl}/mot-de-passe-oublie/nouveau-mot-de-passe`, {
      email, resetToken, nouveauMotDePasse
    }).pipe(
      map(() => null),
      catchError(err => of(err.error?.message || 'Erreur lors de la réinitialisation du mot de passe.'))
    );
  }

  /**
   * SCAFFOLD — pas d'intégration Facebook réelle dans ce projet (aucun SDK chargé, aucun App ID
   * configuré). Garde le même contrat Observable<AuthResponse> que login()/register() pour que
   * les composants appelants n'aient rien de spécial à gérer, mais échoue toujours volontairement
   * avec un message clair plutôt que de simuler une connexion. Pour brancher réellement : même
   * approche que loginWithGoogle() ci-dessus (SDK Facebook + endpoint backend dédié).
   */
  loginWithFacebook(): Observable<AuthResponse> {
    return throwError(() => ({
      error: { message: 'Connexion avec Facebook indisponible pour le moment : configuration développeur requise (FACEBOOK_APP_ID).' }
    }));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get isConnecte(): boolean {
    return !!this.token && !!this.currentUser;
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  get espaceUrl(): string {
    return this.isAdmin ? '/admin' : '/user';
  }

  patchCurrentUser(partial: Partial<AuthUser>): void {
    const utilisateur = this.currentUser;
    if (!utilisateur) return;
    const misAJour = { ...utilisateur, ...partial };
    localStorage.setItem(USER_KEY, JSON.stringify(misAJour));
    this.currentUserSubject.next(misAJour);
  }

  private lireUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private stocker(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
  }
}
