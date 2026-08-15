import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Zone glisser-déposer réutilisable : ne gère que la mécanique (drag/drop, clic pour
 * parcourir, validation extension/taille) et émet les fichiers valides. L'aperçu (FileReader,
 * vignettes, galerie, remplacement) reste local à chaque formulaire consommateur, qui diffère
 * selon le cas d'usage (document unique vs galerie d'images).
 */
@Component({
  selector: 'app-file-drop-zone',
  templateUrl: './file-drop-zone.component.html',
  styleUrls: ['./file-drop-zone.component.css']
})
export class FileDropZoneComponent {
  /** Liste d'extensions séparées par des virgules, ex. ".pdf,.doc,.docx" — aussi utilisée
   *  comme attribut natif `accept` de l'input fichier (filtre indicatif, pas une validation). */
  @Input() accept = '';
  @Input() multiple = false;
  @Input() maxSizeMb = 20;
  @Input() icone = 'fa-cloud-arrow-up';
  @Input() label = 'Glissez-déposez un fichier ici, ou cliquez pour parcourir';
  @Input() sousLabel = '';
  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() erreur = new EventEmitter<string>();

  survole = false;

  private get extensionsAutorisees(): string[] {
    return this.accept
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.startsWith('.'));
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.survole = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.survole = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.survole = false;
    const fichiers = event.dataTransfer?.files;
    if (fichiers) this.traiter(Array.from(fichiers));
  }

  onFichierSelectionne(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.traiter(Array.from(input.files));
    input.value = '';
  }

  private traiter(fichiers: File[]): void {
    const valides: File[] = [];
    const extensions = this.extensionsAutorisees;

    for (const fichier of fichiers) {
      if (extensions.length > 0) {
        const ext = '.' + (fichier.name.split('.').pop() || '').toLowerCase();
        if (!extensions.includes(ext)) {
          this.erreur.emit(`« ${fichier.name} » : format non autorisé.`);
          continue;
        }
      }
      if (fichier.size > this.maxSizeMb * 1024 * 1024) {
        this.erreur.emit(`« ${fichier.name} » dépasse la taille maximale de ${this.maxSizeMb} Mo.`);
        continue;
      }
      valides.push(fichier);
    }

    if (valides.length === 0) return;
    this.filesSelected.emit(this.multiple ? valides : [valides[0]]);
  }
}
