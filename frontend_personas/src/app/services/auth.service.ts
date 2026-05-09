import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private loggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedIn.asObservable();
  private platformId = inject(PLATFORM_ID);
  private auth = inject(Auth);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Sincroniza el estado con Firebase Auth
      onAuthStateChanged(this.auth, (user) => {
        this.loggedIn.next(!!user);
        localStorage.setItem('isLoggedIn', user ? 'true' : 'false');
      });
    }
  }

  get isLoggedIn(): boolean {
    return this.loggedIn.value;
  }

  login(email: string, pass: string): boolean {
    if (email === 'admin@admin.com' && pass === 'admin123') {
      this.loggedIn.next(true);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('isLoggedIn', 'true');
      }
      return true;
    }
    return false;
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
    // onAuthStateChanged actualizará loggedIn automáticamente
  }

  logout() {
    signOut(this.auth);
    this.loggedIn.next(false);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('isLoggedIn');
    }
  }
}
