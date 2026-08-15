import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';

/**
 * Lecteur Lottie léger et tolérant aux animations manquantes : tant que le fichier
 * `path` (assets/lottie/*.json) n'existe pas dans le repo, une icône Font Awesome
 * animée en CSS s'affiche à la place — rien n'est cassé en attendant les vrais fichiers.
 */
@Component({
  selector: 'app-lottie-player',
  templateUrl: './lottie-player.component.html',
  styleUrls: ['./lottie-player.component.css']
})
export class LottiePlayerComponent implements OnChanges, OnDestroy {
  @Input() path: string = '';
  @Input() fallbackIcon: string = 'fa-file';
  @Input() size: number = 150;

  @ViewChild('conteneur', { static: true }) conteneur!: ElementRef<HTMLDivElement>;

  chargementEchoue: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private animation: any;

  ngOnChanges(): void {
    this.detruireAnimation();
    this.chargementEchoue = false;
    if (!this.path) {
      this.chargementEchoue = true;
      return;
    }
    this.chargerAnimation();
  }

  private async chargerAnimation(): Promise<void> {
    try {
      const lottie = (await import('lottie-web')).default;
      this.animation = lottie.loadAnimation({
        container: this.conteneur.nativeElement,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: this.path
      });
      this.animation.addEventListener('data_failed', () => (this.chargementEchoue = true));
      // `lottie-web` ne rejette pas la promesse XHR en échec HTTP (404) : on vérifie
      // explicitement l'existence du fichier pour basculer sur le repli CSS.
      const reponse = await fetch(this.path, { method: 'HEAD' }).catch(() => null);
      if (!reponse || !reponse.ok) {
        this.chargementEchoue = true;
        this.detruireAnimation();
      }
    } catch {
      this.chargementEchoue = true;
    }
  }

  private detruireAnimation(): void {
    this.animation?.destroy?.();
    this.animation = null;
  }

  ngOnDestroy(): void {
    this.detruireAnimation();
  }
}
