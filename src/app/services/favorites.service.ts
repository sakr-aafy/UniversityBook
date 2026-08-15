import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Favorite {
  _id: string;
  titre: string;
  image: string;
  categorie: string;
  prix: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly apiUrl = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  list(): Observable<Favorite[]> {
    return this.http.get<Favorite[]>(this.apiUrl);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
