import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Adresse } from './user.service';

export interface AdminProfil {
  id?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  photo: string;
  role?: string;
  adresse: Adresse | null;
  dateInscription?: string;
  /** Compte admin « système » (identifiants .env) : lecture seule, non modifiable ici. */
  systeme: boolean;
  modifiable: boolean;
}

export interface AdminProfilUpdatePayload {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface AdminAdresseUpdatePayload {
  gouvernorat: string;
  delegation: string;
  codePostal: string;
  adresse: string;
}

export interface AdminChangePasswordPayload {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
  confirmation: string;
}

@Injectable({ providedIn: 'root' })
export class AdminProfilService {
  private readonly apiUrl = `${environment.apiUrl}/admin/profil`;

  constructor(private http: HttpClient) {}

  getMonProfil(): Observable<AdminProfil> {
    return this.http.get<AdminProfil>(`${this.apiUrl}/moi`);
  }

  updateMonProfil(data: AdminProfilUpdatePayload, photo?: File | null): Observable<{ message: string; profil: AdminProfil }> {
    const formData = new FormData();
    formData.append('nom', data.nom);
    formData.append('prenom', data.prenom);
    formData.append('email', data.email);
    formData.append('telephone', data.telephone);
    if (photo) formData.append('photo', photo);
    return this.http.put<{ message: string; profil: AdminProfil }>(`${this.apiUrl}/moi`, formData);
  }

  updateMonAdresse(data: AdminAdresseUpdatePayload): Observable<{ message: string; adresse: Adresse }> {
    return this.http.put<{ message: string; adresse: Adresse }>(`${this.apiUrl}/adresse`, data);
  }

  changerMonMotDePasse(payload: AdminChangePasswordPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/mot-de-passe`, payload);
  }
}
