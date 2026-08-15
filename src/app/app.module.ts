import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { PanierComponent } from './panier/panier.component';
import { ContactComponent } from './contact/contact.component';
import { HomeComponent } from './home/home.component';
import { BoutiqueComponent } from './boutique/boutique.component';
import { ProduitDetailComponent } from './produit-detail/produit-detail.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { LottiePlayerComponent } from './shared/lottie-player/lottie-player.component';
import { SearchableSelectComponent } from './shared/searchable-select/searchable-select.component';
import { FileDropZoneComponent } from './shared/file-drop-zone/file-drop-zone.component';
import { CategoryDialogComponent } from './shared/category-dialog/category-dialog.component';
import { RevealDirective } from './shared/reveal.directive';
import { AuthInterceptor } from './interceptors/auth.interceptor';

import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { DashbordUserComponent } from './user/dashbord-user/dashbord-user.component';
import { CommandesComponent } from './user/commandes/commandes.component';
import { DocumentsComponent } from './user/documents/documents.component';
import { FavorisComponent } from './user/favoris/favoris.component';
import { PanierComponent as UserPanierComponent } from './user/panier/panier.component';
import { PaiementsComponent } from './user/paiements/paiements.component';
import { ProfilComponent } from './user/profil/profil.component';

import { AdminLayoutComponent } from './admin/admin-layout/admin-layout.component';
import { DashbordAdminComponent } from './admin/dashbord-admin/dashbord-admin.component';
import { UtilisateursComponent } from './admin/utilisateurs/utilisateurs.component';
import { CommandesComponent as AdminCommandesComponent } from './admin/commandes/commandes.component';
import { FournisseursComponent as AdminDocumentsComponent } from './admin/fournisseurs/fournisseurs.component';
import { ProduitsComponent } from './admin/produits/produits.component';
import { AdminProfilComponent } from './admin/profil/admin-profil.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    LoginComponent,
    RegisterComponent,
    PanierComponent,
    ContactComponent,
    HomeComponent,
    BoutiqueComponent,
    ProduitDetailComponent,
    ConfirmDialogComponent,
    LottiePlayerComponent,
    SearchableSelectComponent,
    FileDropZoneComponent,
    CategoryDialogComponent,
    RevealDirective,
    UserLayoutComponent,
    DashbordUserComponent,
    CommandesComponent,
    DocumentsComponent,
    FavorisComponent,
    UserPanierComponent,
    PaiementsComponent,
    ProfilComponent,
    AdminLayoutComponent,
    DashbordAdminComponent,
    UtilisateursComponent,
    AdminCommandesComponent,
    AdminDocumentsComponent,
    ProduitsComponent,
    AdminProfilComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule
  ],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }],
  bootstrap: [AppComponent]
})
export class AppModule { }
