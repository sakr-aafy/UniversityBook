import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppNotification {
  _id: string;
  titre: string;
  message: string;
  lu: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  list(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.apiUrl);
  }

  markRead(id: string): Observable<AppNotification> {
    return this.http.put<AppNotification>(`${this.apiUrl}/${id}/lire`, {});
  }

  markAllRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/lire-tout`, {});
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
