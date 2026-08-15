import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const userGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isConnecte) {
    return router.parseUrl('/login');
  }
  return true;
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isConnecte) {
    return router.parseUrl('/login');
  }
  if (!authService.isAdmin) {
    return router.parseUrl('/user');
  }
  return true;
};
