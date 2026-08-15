import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Adresse {
  _id?: string;
  libelle: string;
  ligne1: string;
  ligne2?: string;
  ville?: string;
  gouvernorat?: string;
  delegation?: string;
  codePostal?: string;
  pays?: string;
  parDefaut: boolean;
}

export interface Parametres {
  langue: 'FR' | 'EN' | 'AR';
  notifEmail: boolean;
  notifSms: boolean;
  modeSombre: boolean;
}

export interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  telephoneSecondaire?: string;
  dateNaissance?: string | null;
  genre?: 'Homme' | 'Femme' | 'Autre' | null;
  photo: string;
  role: string;
  adresses: Adresse[];
  parametres: Parametres;
  dateInscription: string;
  derniereConnexion?: string | null;
}

export interface OrderSummary {
  _id: string;
  numero: string;
  total: number;
  statut: string;
  paiement: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  titre: string;
  message: string;
  lu: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalCommandes: number;
  commandesTerminees: number;
  commandesEnAttente: number;
  documentsAchetes: number;
  favoris: number;
  totalAchats: number;
  totalTelechargements: number;
}

export interface DashboardData {
  user: UserProfile;
  stats: DashboardStats;
  dernieresCommandes: OrderSummary[];
  dernieresNotifications: NotificationItem[];
}

export interface ChangePasswordPayload {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
  confirmation: string;
}

export type TypeActivite = 'connexion' | 'commande' | 'telechargement' | 'paiement' | 'profil';

export interface ActiviteItem {
  _id: string;
  type: TypeActivite;
  description: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/me/dashboard`);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`);
  }

  updateProfile(
    data: {
      nom: string; prenom: string; email: string; telephone: string;
      telephoneSecondaire?: string; dateNaissance?: string; genre?: string;
    },
    photo?: File | null
  ): Observable<{ message: string; user: UserProfile }> {
    const formData = new FormData();
    formData.append('nom', data.nom);
    formData.append('prenom', data.prenom);
    formData.append('email', data.email);
    formData.append('telephone', data.telephone);
    formData.append('telephoneSecondaire', data.telephoneSecondaire || '');
    if (data.dateNaissance) formData.append('dateNaissance', data.dateNaissance);
    if (data.genre) formData.append('genre', data.genre);
    if (photo) formData.append('photo', photo);
    return this.http.put<{ message: string; user: UserProfile }>(`${this.apiUrl}/me`, formData);
  }

  changePassword(payload: ChangePasswordPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/me/password`, payload);
  }

  getAdresses(): Observable<Adresse[]> {
    return this.http.get<Adresse[]>(`${this.apiUrl}/me/adresses`);
  }

  addAdresse(adresse: Adresse): Observable<{ message: string; adresses: Adresse[] }> {
    return this.http.post<{ message: string; adresses: Adresse[] }>(`${this.apiUrl}/me/adresses`, adresse);
  }

  updateAdresse(id: string, adresse: Adresse): Observable<{ message: string; adresses: Adresse[] }> {
    return this.http.put<{ message: string; adresses: Adresse[] }>(`${this.apiUrl}/me/adresses/${id}`, adresse);
  }

  deleteAdresse(id: string): Observable<{ message: string; adresses: Adresse[] }> {
    return this.http.delete<{ message: string; adresses: Adresse[] }>(`${this.apiUrl}/me/adresses/${id}`);
  }

  getParametres(): Observable<Parametres> {
    return this.http.get<Parametres>(`${this.apiUrl}/me/parametres`);
  }

  updateParametres(parametres: Parametres): Observable<{ message: string; parametres: Parametres }> {
    return this.http.put<{ message: string; parametres: Parametres }>(`${this.apiUrl}/me/parametres`, parametres);
  }

  getActivites(): Observable<ActiviteItem[]> {
    return this.http.get<ActiviteItem[]>(`${this.apiUrl}/me/activites`);
  }
}
