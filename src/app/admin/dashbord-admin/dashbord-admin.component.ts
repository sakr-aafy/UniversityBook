import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AdminStatsService, AdminDashboardData, AdminActiviteItem } from '../../services/admin-stats.service';
import { photoUrl } from '../../shared/photo-url.util';

interface CourbePoints {
  points: string;
  aire: string;
}

const ICONES_ACTIVITE: Record<string, string> = {
  connexion: 'fa-right-to-bracket',
  commande: 'fa-bag-shopping',
  telechargement: 'fa-download',
  paiement: 'fa-wallet',
  profil: 'fa-user-pen'
};

const COULEURS_ACTIVITE: Record<string, string> = {
  connexion: '#2563EB',
  commande: '#8C2433',
  telechargement: '#16A34A',
  paiement: '#B45309',
  profil: '#7C3AED'
};

const LARGEUR_COURBE = 300;
const HAUTEUR_COURBE = 100;
const PADDING_COURBE = 8;

@Component({
  selector: 'app-dashbord-admin',
  templateUrl: './dashbord-admin.component.html',
  styleUrls: ['./dashbord-admin.component.css']
})
export class DashbordAdminComponent implements OnInit {
  donnees: AdminDashboardData | null = null;
  activites: AdminActiviteItem[] = [];
  chargement: boolean = true;
  erreur: string = '';

  courbeCommandes: CourbePoints | null = null;
  courbeRevenu: CourbePoints | null = null;
  courbeUtilisateurs: CourbePoints | null = null;

  constructor(private adminStatsService: AdminStatsService) {}

  ngOnInit(): void {
    forkJoin({
      donnees: this.adminStatsService.getStats(),
      activites: this.adminStatsService.getActivites()
    }).subscribe({
      next: ({ donnees, activites }) => {
        this.donnees = donnees;
        this.activites = activites.slice(0, 8);
        this.construireCourbes();
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les statistiques.';
        this.chargement = false;
      }
    });
  }

  photoDe(chemin?: string): string {
    return photoUrl(chemin);
  }

  iconeActivite(type: string): string {
    return ICONES_ACTIVITE[type] || 'fa-circle';
  }

  couleurActivite(type: string): string {
    return COULEURS_ACTIVITE[type] || '#3C444E';
  }

  private construireCourbes(): void {
    if (!this.donnees) return;

    const commandes = this.donnees.serieCommandes.map(p => p.commandes);
    const revenu = this.donnees.serieCommandes.map(p => p.revenu);
    const utilisateurs = this.donnees.serieUtilisateurs.map(p => p.count);

    this.courbeCommandes = this.construireCourbe(commandes);
    this.courbeRevenu = this.construireCourbe(revenu);
    this.courbeUtilisateurs = this.construireCourbe(utilisateurs);
  }

  /** Construit une courbe SVG (polyline + aire remplie) normalisée sur un viewBox fixe,
   *  même principe que le donut du dashboard client (dashbord-user.component.ts). */
  private construireCourbe(valeurs: number[]): CourbePoints {
    const max = Math.max(...valeurs, 1);
    const n = valeurs.length;
    const points = valeurs.map((v, i) => {
      const x = n > 1 ? (i / (n - 1)) * LARGEUR_COURBE : 0;
      const y = HAUTEUR_COURBE - PADDING_COURBE - (v / max) * (HAUTEUR_COURBE - 2 * PADDING_COURBE);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const aire = `0,${HAUTEUR_COURBE} ${points.join(' ')} ${LARGEUR_COURBE},${HAUTEUR_COURBE}`;
    return { points: points.join(' '), aire };
  }
}
