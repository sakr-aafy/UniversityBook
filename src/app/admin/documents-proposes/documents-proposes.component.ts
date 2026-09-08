import { Component, OnInit } from '@angular/core';
import {
  AdminDocumentsProposesService, DocumentProposeAdmin, StatutProposition
} from '../../services/admin-documents-proposes.service';

@Component({
  selector: 'app-documents-proposes',
  templateUrl: './documents-proposes.component.html',
  styleUrls: ['./documents-proposes.component.css']
})
export class DocumentsProposesComponent implements OnInit {
  propositions: DocumentProposeAdmin[] = [];
  nbEnAttente = 0;
  chargement = true;
  erreur = '';
  message = '';

  filtreStatut: StatutProposition | '' = 'en_attente';

  // Actions en cours (anti double-clic) et modale de refus.
  actionEnCoursId: string | null = null;
  refusPour: DocumentProposeAdmin | null = null;
  motifRefus = '';

  constructor(private api: AdminDocumentsProposesService) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = '';
    this.api.list(this.filtreStatut).subscribe({
      next: res => {
        this.propositions = res.propositions || [];
        this.nbEnAttente = res.nbEnAttente || 0;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les propositions.';
        this.chargement = false;
      }
    });
  }

  changerFiltre(statut: StatutProposition | ''): void {
    this.filtreStatut = statut;
    this.charger();
  }

  libelleStatut(s: StatutProposition): string {
    return s === 'approuve' ? 'Approuvé' : s === 'refuse' ? 'Refusé' : 'En attente';
  }

  ouvrirFichier(p: DocumentProposeAdmin): void {
    if (p.fichier) window.open(p.fichier, '_blank', 'noopener');
  }

  approuver(p: DocumentProposeAdmin): void {
    if (this.actionEnCoursId) return;
    if (!confirm(`Approuver « ${p.titre} » ? Le document sera publié gratuitement sur le site.`)) return;
    this.actionEnCoursId = p._id;
    this.message = '';
    this.api.approuver(p._id).subscribe({
      next: res => {
        this.actionEnCoursId = null;
        this.message = res.message;
        this.appliquerMaj(res.proposition);
      },
      error: err => {
        this.actionEnCoursId = null;
        this.erreur = err?.error?.message || "Erreur lors de l'approbation.";
      }
    });
  }

  ouvrirRefus(p: DocumentProposeAdmin): void {
    this.refusPour = p;
    this.motifRefus = '';
  }

  fermerRefus(): void {
    if (this.actionEnCoursId) return;
    this.refusPour = null;
  }

  confirmerRefus(): void {
    if (!this.refusPour || this.actionEnCoursId) return;
    const p = this.refusPour;
    this.actionEnCoursId = p._id;
    this.message = '';
    this.api.refuser(p._id, this.motifRefus.trim()).subscribe({
      next: res => {
        this.actionEnCoursId = null;
        this.refusPour = null;
        this.message = res.message;
        this.appliquerMaj(res.proposition);
      },
      error: err => {
        this.actionEnCoursId = null;
        this.erreur = err?.error?.message || 'Erreur lors du refus.';
      }
    });
  }

  supprimer(p: DocumentProposeAdmin): void {
    if (this.actionEnCoursId) return;
    if (!confirm(`Supprimer définitivement la proposition « ${p.titre} » ? Le document déjà publié n'est pas retiré.`)) return;
    this.actionEnCoursId = p._id;
    this.api.supprimer(p._id).subscribe({
      next: res => {
        this.actionEnCoursId = null;
        this.message = res.message;
        this.propositions = this.propositions.filter(x => x._id !== p._id);
        if (p.statut === 'en_attente') this.nbEnAttente = Math.max(0, this.nbEnAttente - 1);
      },
      error: err => {
        this.actionEnCoursId = null;
        this.erreur = err?.error?.message || 'Erreur lors de la suppression.';
      }
    });
  }

  /** Remplace la proposition mise à jour dans la liste, ou la retire si elle ne correspond plus
   *  au filtre courant ; recale le compteur « en attente ». */
  private appliquerMaj(maj: DocumentProposeAdmin): void {
    this.nbEnAttente = this.propositions.filter(x => x._id !== maj._id && x.statut === 'en_attente').length
      + (maj.statut === 'en_attente' ? 1 : 0);
    if (this.filtreStatut && maj.statut !== this.filtreStatut) {
      this.propositions = this.propositions.filter(x => x._id !== maj._id);
      return;
    }
    const idx = this.propositions.findIndex(x => x._id === maj._id);
    if (idx >= 0) this.propositions[idx] = maj;
  }

  trackById(_i: number, item: DocumentProposeAdmin): string {
    return item._id;
  }
}
