import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  sidebarOpen: boolean = false;
  isMobile: boolean = false;
  private authSub!: Subscription;

  menuItems: MenuItem[] = [
    { label: 'Tableau de bord', icon: 'fa-gauge', route: '/admin/dashboard' },
    { label: 'Utilisateurs', icon: 'fa-users', route: '/admin/utilisateurs' },
    { label: 'Commandes', icon: 'fa-box', route: '/admin/commandes' },
    { label: 'Documents', icon: 'fa-file-pdf', route: '/admin/documents' },
    { label: 'Produits', icon: 'fa-store', route: '/admin/produits' }
  ];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.updateMobile();
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
