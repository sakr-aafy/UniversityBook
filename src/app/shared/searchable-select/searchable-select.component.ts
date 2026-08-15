import { Component, ElementRef, forwardRef, HostListener, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Liste déroulante filtrable au clavier, compatible ngModel et formControlName.
 * Utilisée pour Gouvernorat / Délégation (Panier + Profil), réutilisable pour toute autre liste.
 */
@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() options: string[] = [];
  @Input() placeholder = 'Rechercher…';
  @Input() emptyMessage = 'Aucun résultat';
  @Input() invalid = false;

  ouvert = false;
  filtre = '';
  valeur = '';
  disabled = false;

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get optionsFiltrees(): string[] {
    const q = normaliser(this.filtre.trim());
    if (!q) return this.options;
    return this.options.filter(opt => normaliser(opt).includes(q));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.fermer();
    }
  }

  ouvrir(): void {
    if (this.disabled) return;
    this.ouvert = true;
  }

  fermer(): void {
    if (!this.ouvert) return;
    this.ouvert = false;
    // Si le texte tapé ne correspond à aucune option valide, on revient à la valeur sélectionnée.
    this.filtre = this.valeur || '';
    this.onTouched();
  }

  onFiltreChange(): void {
    this.ouvert = true;
    if (this.valeur && this.filtre !== this.valeur) {
      this.valeur = '';
      this.onChange('');
    }
  }

  selectionner(option: string): void {
    this.valeur = option;
    this.filtre = option;
    this.ouvert = false;
    this.onChange(option);
    this.onTouched();
  }

  writeValue(value: string): void {
    this.valeur = value || '';
    this.filtre = this.valeur;
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
