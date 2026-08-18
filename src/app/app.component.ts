import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'frontweb';

  /** /admin et /user ont chacun leur propre layout complet (sidebar, en-tête de compte — voir
   *  AdminLayoutComponent/UserLayoutComponent) : le header/footer public ne doit s'afficher que
   *  pour le reste du site, sinon les deux chromes se superposent (double navigation, double
   *  branding, formulaires écrasés entre les deux — voir admin/produits). */
  afficherChromePublic = true;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.majChromePublic(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.majChromePublic(e.urlAfterRedirects));
  }

  private majChromePublic(url: string): void {
    this.afficherChromePublic = !url.startsWith('/admin') && !url.startsWith('/user');
  }
}
