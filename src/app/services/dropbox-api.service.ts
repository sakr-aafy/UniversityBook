import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DropboxEntry {
  nom: string;
  chemin: string;
  type: 'dossier' | 'fichier';
}

@Injectable({ providedIn: 'root' })
export class DropboxApiService {
  private readonly base = `${environment.apiUrl}/caisse/dropbox`;

  constructor(private http: HttpClient) {}

  list(chemin: string): Observable<{ chemin: string; entrees: DropboxEntry[] }> {
    return this.http.get<{ chemin: string; entrees: DropboxEntry[] }>(this.base, {
      params: { chemin: chemin || '' }
    });
  }
}
