import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

/**
 * Ajoute la classe `ub-revealed` à l'hôte dès qu'il entre dans le viewport,
 * pour déclencher une animation d'apparition CSS au scroll (sans dépendance).
 */
@Directive({
  selector: '[ubReveal]'
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.el.nativeElement.classList.add('ub-reveal');

    if (!('IntersectionObserver' in window)) {
      this.el.nativeElement.classList.add('ub-revealed');
      return;
    }

    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.el.nativeElement.classList.add('ub-revealed');
          this.observer?.disconnect();
        }
      });
    }, { threshold: .15 });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
