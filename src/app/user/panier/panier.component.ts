import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService, PanierItem } from '../../services/cart.service';

@Component({
  selector: 'app-user-panier',
  templateUrl: './panier.component.html',
  styleUrls: ['./panier.component.css']
})
export class PanierComponent implements OnInit, OnDestroy {
  items: PanierItem[] = [];
  total: number = 0;
  private sub!: Subscription;

  constructor(private cartService: CartService, private router: Router) {}

  ngOnInit(): void {
    this.sub = this.cartService.items$.subscribe(items => {
      this.items = items;
      this.total = this.cartService.total;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  incrementer(id: number): void {
    this.cartService.incrementer(id);
  }

  decrementer(id: number): void {
    this.cartService.decrementer(id);
  }

  supprimer(id: number): void {
    this.cartService.supprimer(id);
  }

  vider(): void {
    this.cartService.vider();
  }

  payer(): void {
    this.router.navigate(['/panier']);
  }
}
