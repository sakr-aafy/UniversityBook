import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmOptions } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  options: ConfirmOptions | null = null;
  private sub!: Subscription;

  constructor(private confirmDialogService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.sub = this.confirmDialogService.options$.subscribe(options => {
      this.options = options;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  repondre(valeur: boolean): void {
    this.confirmDialogService.repondre(valeur);
  }
}
