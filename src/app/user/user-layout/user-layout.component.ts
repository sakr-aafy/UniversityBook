import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { photoUrl } from '../../shared/photo-url.util';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  compteurCle?: 'documents' | 'favoris' | 'enAttente';
}

@Component({
  selector: 'app-user-layout',
  templateUrl: './user-layout.component.html',
  styleUrls: ['./user-layout.component.css']
})
export class UserLayoutComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  sidebarOpen: boolean = false;
  isMobile: boolean = false;
  private authSub!: Subscription;

  compteurs: Record<string, number> = {};

  menuItems: MenuItem[] = [
    { label: 'Tableau de bord', icon: 'fa-gauge', route: '/user/dashboard' },
    { label: 'Mes documents', icon: 'fa-book', route: '/user/documents', compteurCle: 'documents' },
    { label: 'Mes favoris', icon: 'fa-heart', route: '/user/favoris', compteurCle: 'favoris' },
    { label: 'Mes commandes', icon: 'fa-box', route: '/user/commandes', compteurCle: 'enAttente' },
    { label: 'Tickets & factures', icon: 'fa-receipt', route: '/user/tickets-factures' },
    { label: 'Paiements', icon: 'fa-credit-card', route: '/user/paiements' },
    { label: 'Mon profil', icon: 'fa-user', route: '/user/profil' }
  ];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private confirmDialogService: ConfirmDialogService,
    private router: Router
  ) {}

  get photoUrl(): string {
    return photoUrl(this.currentUser?.photo);
  }

  ngOnInit(): void {
    this.updateMobile();
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.userService.getDashboard().subscribe({
      next: donnees => {
        this.compteurs = {
          documents: donnees.stats.documentsAchetes,
          favoris: donnees.stats.favoris,
          enAttente: donnees.stats.commandesEnAttente
        };
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  @HostListener('window:resize')
  updateMobile(): void {
    this.isMobile = window.innerWidth <= 992;
    if (!this.isMobile) this.sidebarOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  async logout(): Promise<void> {
    const confirme = await this.confirmDialogService.confirmer({
      titre: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      icone: 'fa-right-from-bracket',
      labelConfirmer: 'Se déconnecter'
    });
    if (!confirme) return;
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
