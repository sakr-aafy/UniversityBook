import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  form = {
    nom: '',
    email: '',
    sujet: '',
    message: ''
  };

  submitted = false;

  send(): void {
    this.submitted = true;
  }
}
