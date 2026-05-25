import {
  Injectable,
  inject,
  PLATFORM_ID
} from '@angular/core';

import {
  isPlatformBrowser
} from '@angular/common';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  BehaviorSubject
} from 'rxjs';

import {
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient) as any;
  private platformId = inject(PLATFORM_ID);
  private fireAuth = inject(Auth);

  apiUrl = 'http://127.0.0.1:8000/api';

  private loggedInSubject =
    new BehaviorSubject<boolean>(false);

  isLoggedIn$ =
    this.loggedInSubject.asObservable();

  constructor() {

    // Evitar error SSR
    if (isPlatformBrowser(this.platformId)) {
      const usuario = localStorage.getItem('usuario');
      this.loggedInSubject.next(!!usuario);
    }
  }

  // ==========================
  // LOGIN FASTAPI
  // ==========================
  login(
    email: string,
    password: string
  ): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/login`,
      {
        correo: email,
        password: password
      }
    );
  }

  // ==========================
  // REGISTER FASTAPI
  // ==========================
  register(
    email: string,
    password: string
  ): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/register`,
      {
        nombre: email.split('@')[0],
        correo: email,
        password: password
      }
    );
  }

  // ==========================
  // LOGIN STATUS
  // ==========================
  get isLoggedIn(): boolean {

    if (isPlatformBrowser(this.platformId)) {
      return !!localStorage.getItem('usuario');
    }

    return false;
  }

  // ==========================
  // SET LOGIN
  // ==========================
  setLoggedIn() {
    this.loggedInSubject.next(true);
  }

  // ==========================
  // LOGOUT
  // ==========================
  logout() {

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('usuario');
    }

    // También cerrar sesión de Firebase si está activo
    signOut(this.fireAuth).catch(() => {});

    this.loggedInSubject.next(false);
  }

  async loginWithGoogle(): Promise<any> {

    const provider = new GoogleAuthProvider();

    // Forzar selección de cuenta cada vez
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(this.fireAuth, provider);

    const user = result.user;

    const usuario = {
      nombre: user.displayName ?? user.email?.split('@')[0] ?? 'Usuario',
      correo: user.email ?? '',
      foto: user.photoURL ?? '',
      uid: user.uid,
      proveedor: 'google'
    };

    return usuario;
  }

  requestGoogleOTP(correo: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/google-otp`,
      {
        correo
      }
    );
  }

  verifyOTP(
    correo: string,
    codigo: string
  ) {

    return this.http.post(
      `${this.apiUrl}/verificar-otp`,
      {
        correo,
        codigo
      }
    );
  }

}