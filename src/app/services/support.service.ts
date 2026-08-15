import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SupportMessage {
  _id?: string;
  auteur: 'user' | 'admin';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  sujet: string;
  statut: 'Ouvert' | 'Fermé';
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly apiUrl = `${environment.apiUrl}/support`;

  constructor(private http: HttpClient) {}

  list(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.apiUrl);
  }

  getOne(id: string): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.apiUrl}/${id}`);
  }

  create(sujet: string, message: string): Observable<{ message: string; ticket: SupportTicket }> {
    return this.http.post<{ message: string; ticket: SupportTicket }>(this.apiUrl, { sujet, message });
  }

  reply(id: string, message: string): Observable<{ message: string; ticket: SupportTicket }> {
    return this.http.post<{ message: string; ticket: SupportTicket }>(`${this.apiUrl}/${id}/messages`, { message });
  }

  close(id: string): Observable<{ message: string; ticket: SupportTicket }> {
    return this.http.put<{ message: string; ticket: SupportTicket }>(`${this.apiUrl}/${id}/fermer`, {});
  }
}
