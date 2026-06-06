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

  // 🚀 CORREGIDO: Le agregamos : HttpClient para que TypeScript reconozca los métodos .get y .post
  private http: HttpClient = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private fireAuth = inject(Auth);

  apiUrl = 'http://127.0.0.1:8000/api';

  private loggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedInSubject.asObservable();

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
  login(email: string, password: string): Observable<any> {
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
  register(email: string, password: string): Observable<any> {
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
    signOut(this.fireAuth).catch(() => {});
    this.loggedInSubject.next(false);
  }

  // ==========================
  // GOOGLE LOGIN (AUTOMATIZADO)
  // ==========================
  async loginWithGoogle(): Promise<any> {
    const provider = new GoogleAuthProvider();

    // Forzar selección de cuenta cada vez
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      // 1. Ejecutar la autenticación en el popup de Firebase
      const result = await signInWithPopup(this.fireAuth, provider);
      const user = result.user;

      const usuario = {
        nombre: user.displayName ?? user.email?.split('@')[0] ?? 'Usuario',
        correo: user.email ?? '',
        foto: user.photoURL ?? '',
        uid: user.uid,
        proveedor: 'google'
      };

      console.log('🌐 [GOOGLE AUTH NATIVE]: Identidad validada para', usuario.correo);

      // 2. 🚀 ENLACE EN CALIENTE AUTOMÁTICO: Dispara el OTP directamente al backend 
      // sin esperar a que el 'login.ts' realice procesos secundarios.
      if (usuario.correo) {
        this.requestGoogleOTP(usuario.correo).subscribe({
          next: (res: any) => console.log('📧 [SMTP GOOGLE SUCCESS]: Correo despachado por FastAPI.'),
          error: (err: any) => console.error('🚨 Error enviando solicitud OTP al backend:', err)
        });
      }

      return usuario;

    } catch (error: any) {
      console.error('🚨 [GOOGLE POPUP CRITICAL]: Ocurrió un error en la ventana flotante:', error);
      throw error;
    }
  }

  requestGoogleOTP(correo: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/google-otp`,
      {
        correo
      }
    );
  }

  verifyOTP(correo: string, codigo: string) {
    return this.http.post(
      `${this.apiUrl}/verificar-otp`,
      {
        correo,
        codigo
      }
    );
  }
}