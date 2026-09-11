import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocumentsService, DocumentAutorise } from '../services/documents.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-documents-autorises',
  templateUrl: './documents-autorises.component.html',
  styleUrls: ['./documents-autorises.component.css']
})
export class DocumentsAutorisesComponent implements OnInit {
  documents: DocumentAutorise[] = [];
  chargement = true;
  erreur = '';
  recherche = '';
  /** id du document ajouté à l'instant — pour l'animation « Ajouté ✓ » du bouton. */
  ajouteId: string | null = null;

  constructor(
    private documentsService: DocumentsService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = '';
    this.documentsService
      .documentsAutorises()
      .pipe(catchError(() => of({ documents: [] as DocumentAutorise[] })))
      .subscribe({
        next: res => {
          this.documents = res.documents || [];
          this.chargement = false;
        },
        error: () => {
          this.erreur = 'Impossible de charger vos autorisations pour le moment.';
          this.chargement = false;
        }
      });
  }

  get documentsFiltres(): DocumentAutorise[] {
    const q = this.recherche.trim().toLowerCase();
    if (!q) return this.documents;
    return this.documents.filter(
      d =>
        d.titre.toLowerCase().includes(q) ||
        (d.categorie || '').toLowerCase().includes(q) ||
        (d.sousCategorie || '').toLowerCase().includes(q)
    );
  }

  formatPrix(v: number): string {
    if (!v) return 'Gratuit';
    return v.toFixed(3).replace('.', ',') + ' د.ت';
  }

  ajouterPanier(d: DocumentAutorise): void {
    this.cartService.ajouter({
      id: d.produitId,
      titre: d.titre,
      categorie: d.categorie || 'Livre',
      prix: d.prix,
      icone: 'fa-book',
      produitId: d.produitId,
      type: d.sousCategorie || ''
    });
    this.ajouteId = d.id;
    setTimeout(() => {
      if (this.ajouteId === d.id) this.ajouteId = null;
    }, 1600);
  }

  trackById(_index: number, item: DocumentAutorise): string {
    return item.id;
  }
}
