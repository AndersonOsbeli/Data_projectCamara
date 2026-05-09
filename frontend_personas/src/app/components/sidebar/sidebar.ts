import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(event: Event) {
    event.preventDefault();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
