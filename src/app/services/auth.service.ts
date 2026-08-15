import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RegisterPayload {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  motDePasse: string;
}

export interface LoginPayload {
  email: string;
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

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(tap(res => this.stocker(res)));
  }

  /**
   * SCAFFOLD — pas d'intégration OAuth réelle dans ce projet (aucun SDK Google/Facebook chargé,
   * aucun Client ID configuré). Ces deux méthodes gardent le même contrat Observable<AuthResponse>
   * que login()/register() pour que les composants appelants n'aient rien de spécial à gérer,
   * mais échouent toujours volontairement avec un message clair plutôt que de simuler une
   * connexion. Pour brancher réellement : charger le SDK du fournisseur, obtenir un credential/
   * jeton côté client, puis POST vers /api/auth/oauth/google|facebook (endpoints déjà en place,
   * voir backend/controllers/auth.controller.js) au lieu de throwError ci-dessous.
   */
  loginWithGoogle(): Observable<AuthResponse> {
    return throwError(() => ({
      error: { message: 'Connexion avec Google indisponible pour le moment : configuration développeur requise (GOOGLE_CLIENT_ID).' }
    }));
  }

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
