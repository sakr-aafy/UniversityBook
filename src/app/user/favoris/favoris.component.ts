import { Component, OnInit } from '@angular/core';
import { FavoritesService, Favorite } from '../../services/favorites.service';
import { CartService } from '../../services/cart.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-favoris',
  templateUrl: './favoris.component.html',
  styleUrls: ['./favoris.component.css']
})
export class FavorisComponent implements OnInit {
  favoris: Favorite[] = [];
  chargement: boolean = true;
  erreur: string = '';
  favoriDetail: Favorite | null = null;
  retirantIds: Set<string> = new Set();

  constructor(
    private favoritesService: FavoritesService,
    private cartService: CartService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.favoritesService.list().subscribe({
      next: favoris => {
        this.favoris = favoris;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger vos favoris.';
        this.chargement = false;
      }
    });
  }

  async retirer(favori: Favorite): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Retirer des favoris',
      message: `Voulez-vous retirer « ${favori.titre} » de vos favoris ?`,
      icone: 'fa-heart-crack',
      variante: 'danger',
      labelConfirmer: 'Retirer'
    });
    if (!confirme) return;

    this.favoriDetail = null;
    this.retirantIds.add(favori._id);
    this.favoritesService.remove(favori._id).subscribe({
      next: () => {
        setTimeout(() => {
          this.favoris = this.favoris.filter(f => f._id !== favori._id);
          this.retirantIds.delete(favori._id);
        }, 260);
      },
      error: () => {
        this.retirantIds.delete(favori._id);
        this.erreur = 'Erreur lors de la suppression du favori.';
      }
    });
  }

  estEnRetrait(favori: Favorite): boolean {
    return this.retirantIds.has(favori._id);
  }

  ajouterAuPanier(favori: Favorite): void {
    this.cartService.ajouter({
      id: Date.now(),
      titre: favori.titre,
      categorie: favori.categorie,
      prix: favori.prix,
      icone: 'fa-file-pdf'
    });
  }

  voir(favori: Favorite): void {
    this.favoriDetail = favori;
  }

  fermerDetail(): void {
    this.favoriDetail = null;
  }

  trackById(_index: number, item: Favorite): string {
    return item._id;
  }
}
