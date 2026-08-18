import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { PanierComponent } from './panier/panier.component';
import { ContactComponent } from './contact/contact.component';
import { BoutiqueComponent } from './boutique/boutique.component';
import { ProduitDetailComponent } from './produit-detail/produit-detail.component';
import { userGuard, adminGuard } from './guards/auth.guard';

import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { DashbordUserComponent } from './user/dashbord-user/dashbord-user.component';
import { CommandesComponent } from './user/commandes/commandes.component';
import { DocumentsComponent } from './user/documents/documents.component';
import { FavorisComponent } from './user/favoris/favoris.component';
import { PanierComponent as UserPanierComponent } from './user/panier/panier.component';
import { PaiementsComponent } from './user/paiements/paiements.component';
import { ProfilComponent } from './user/profil/profil.component';
import { TicketsFacturesComponent } from './user/tickets-factures/tickets-factures.component';

import { AdminLayoutComponent } from './admin/admin-layout/admin-layout.component';
import { DashbordAdminComponent } from './admin/dashbord-admin/dashbord-admin.component';
import { UtilisateursComponent } from './admin/utilisateurs/utilisateurs.component';
import { CommandesComponent as AdminCommandesComponent } from './admin/commandes/commandes.component';
import { FournisseursComponent as AdminDocumentsComponent } from './admin/fournisseurs/fournisseurs.component';
import { ProduitsComponent } from './admin/produits/produits.component';
import { AdminProfilComponent } from './admin/profil/admin-profil.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'boutique', component: BoutiqueComponent },
  { path: 'produit/:id', component: ProduitDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'panier', component: PanierComponent },
  { path: 'contact', component: ContactComponent },
  {
    path: 'user',
    component: UserLayoutComponent,
    canActivate: [userGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashbordUserComponent },
      { path: 'commandes', component: CommandesComponent },
      { path: 'documents', component: DocumentsComponent },
      { path: 'tickets-factures', component: TicketsFacturesComponent },
      { path: 'favoris', component: FavorisComponent },
      { path: 'panier', component: UserPanierComponent },
      { path: 'paiements', component: PaiementsComponent },
      { path: 'profil', component: ProfilComponent }
    ]
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashbordAdminComponent },
      { path: 'utilisateurs', component: UtilisateursComponent },
      { path: 'commandes', component: AdminCommandesComponent },
      { path: 'documents', component: AdminDocumentsComponent },
      { path: 'produits', component: ProduitsComponent },
      { path: 'profil', component: AdminProfilComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
