import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.token;
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // Jeton présent mais rejeté par le backend (expiré, secret JWT tourné) : la session
        // locale est morte alors que les guards la croient encore valide — on la purge et on
        // renvoie vers /login plutôt que de laisser l'utilisateur coincé sur une page qui
        // n'affiche que des erreurs 401.
        // - Uniquement 401 : un 403 est une question de droits, pas de session (ex. un admin
        //   reçoit volontairement 403 sur /notifications, voir header.component.ts) — le
        //   traiter ici déconnecterait l'admin à chaque chargement de page.
        // - /auth/* exclu : un mauvais mot de passe ou un code OTP invalide ne doit rien effacer.
        const estAppelAuth = req.url.includes('/auth/');
        if (token && !estAppelAuth && err.status === 401) {
          this.authService.logout();
          if (!this.router.url.startsWith('/login')) {
            this.router.navigate(['/login'], { queryParams: { sessionExpiree: 1 } });
          }
        }
        return throwError(() => err);
      })
    );
  }
}
