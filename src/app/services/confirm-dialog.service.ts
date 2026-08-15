import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmOptions {
  titre: string;
  message: string;
  icone?: string;
  variante?: 'danger' | 'default';
  labelConfirmer?: string;
  labelAnnuler?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private optionsSubject = new BehaviorSubject<ConfirmOptions | null>(null);
  options$ = this.optionsSubject.asObservable();

  private resoudre: ((valeur: boolean) => void) | null = null;

  confirmer(options: ConfirmOptions): Promise<boolean> {
    this.optionsSubject.next(options);
    return new Promise<boolean>(resolve => {
      this.resoudre = resolve;
    });
  }

  repondre(valeur: boolean): void {
    this.optionsSubject.next(null);
    this.resoudre?.(valeur);
    this.resoudre = null;
  }
}
