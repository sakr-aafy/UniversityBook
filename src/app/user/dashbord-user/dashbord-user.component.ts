import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UserService, DashboardData } from '../../services/user.service';
import { DocumentsService, PurchasedDocument } from '../../services/documents.service';
import { FavoritesService, Favorite } from '../../services/favorites.service';
import { photoUrl } from '../../shared/photo-url.util';

interface ActiviteItem {
  icone: string;
  couleur: string;
  texte: string;
  date: string;
}

interface SegmentGraphique {
  label: string;
  valeur: number;
  couleur: string;
  pourcentage: number;
  dashArray: string;
  dashOffset: number;
}

interface Raccourci {
  label: string;
  icone: string;
  lien: string;
}

@Component({
  selector: 'app-dashbord-user',
  templateUrl: './dashbord-user.component.html',
  styleUrls: ['./dashbord-user.component.css']
})
export class DashbordUserComponent implements OnInit {
  donnees: DashboardData | null = null;
  chargement: boolean = true;
  erreur: string = '';

  documentsRecents: PurchasedDocument[] = [];
  favorisRecents: Favorite[] = [];
  activites: ActiviteItem[] = [];
  segmentsGraphique: SegmentGraphique[] = [];

  raccourcis: Raccourci[] = [
    { label: 'Explorer la boutique', icone: 'fa-shop', lien: '/boutique' },
    { label: 'Mes documents', icone: 'fa-book', lien: '/user/documents' },
    { label: 'Mes favoris', icone: 'fa-heart', lien: '/user/favoris' },
    { label: 'Mon profil', icone: 'fa-user', lien: '/user/profil' }
  ];

  constructor(
    private userService: UserService,
    private documentsService: DocumentsService,
    private favoritesService: FavoritesService
  ) {}

  get photoUrl(): string {
    return photoUrl(this.donnees?.user?.photo);
  }

  get dernierDocument(): PurchasedDocument | null {
    return this.documentsRecents[0] || null;
  }

  get dernierTelechargement(): PurchasedDocument | null {
    const telecharges = this.documentsRecents
      .filter(d => d.derniereTelechargementLe)
      .sort((a, b) => new Date(b.derniereTelechargementLe!).getTime() - new Date(a.derniereTelechargementLe!).getTime());
    return telecharges[0] || null;
  }

  ngOnInit(): void {
    forkJoin({
      dashboard: this.userService.getDashboard(),
      documents: this.documentsService.list({ limite: 5 }),
      favoris: this.favoritesService.list()
    }).subscribe({
      next: ({ dashboard, documents, favoris }) => {
        this.donnees = dashboard;
        this.documentsRecents = documents.documents;
        this.favorisRecents = favoris.slice(0, 5);
        this.construireActivite();
        this.construireGraphique();
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger le tableau de bord pour le moment.';
        this.chargement = false;
      }
    });
  }

  private construireActivite(): void {
    const items: ActiviteItem[] = [];

    for (const c of this.donnees?.dernieresCommandes || []) {
      items.push({
        icone: 'fa-bag-shopping', couleur: '#8C2433',
        texte: `Commande passée — ${c.numero}`,
        date: c.createdAt
      });
    }

    for (const d of this.documentsRecents) {
      items.push({
        icone: 'fa-book', couleur: '#2563EB',
        texte: `Document acheté — ${d.titre}`,
        date: d.dateAchat
      });
      if (d.derniereTelechargementLe) {
        items.push({
          icone: 'fa-download', couleur: '#16A34A',
          texte: `Document téléchargé — ${d.titre}`,
          date: d.derniereTelechargementLe
        });
      }
    }

    for (const f of this.favorisRecents) {
      items.push({
        icone: 'fa-heart', couleur: '#DB2777',
        texte: `Ajouté aux favoris — ${f.titre}`,
        date: f.createdAt
      });
    }

    this.activites = items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }

  /** Construit un donut SVG pur (stroke-dasharray) répartissant Commandes / Favoris / Documents. */
  private construireGraphique(): void {
    const stats = this.donnees?.stats;
    if (!stats) return;

    const rayon = 40;
    const circonference = 2 * Math.PI * rayon;
    const brut = [
      { label: 'Commandes', valeur: stats.totalCommandes, couleur: '#8C2433' },
      { label: 'Favoris', valeur: stats.favoris, couleur: '#DB2777' },
      { label: 'Documents', valeur: stats.documentsAchetes, couleur: '#2563EB' }
    ];
    const total = brut.reduce((acc, s) => acc + s.valeur, 0);

    let offsetCumule = 0;
    this.segmentsGraphique = brut.map(s => {
      const pourcentage = total > 0 ? (s.valeur / total) * 100 : 0;
      const longueurArc = (pourcentage / 100) * circonference;
      const segment: SegmentGraphique = {
        label: s.label,
        valeur: s.valeur,
        couleur: s.couleur,
        pourcentage: Math.round(pourcentage),
        dashArray: `${longueurArc} ${circonference - longueurArc}`,
        dashOffset: -offsetCumule
      };
      offsetCumule += longueurArc;
      return segment;
    });
  }
}
