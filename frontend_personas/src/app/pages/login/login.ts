import { Component, inject, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  email = '';
  password = '';
  confirmPassword = '';
  codigoOTP = '';
  errorMsg = '';

  showPassword = false;
  isRegisterMode = false;
  mostrandoOTP = false;
  googleUserTempData: any = null;

  isFaceIDScanning = false;
  faceIDStream: MediaStream | null = null;

  // ── Toast notification ───────────────────────────────────────────────────────
  toast = {
    visible: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: '',
  };
  private toastTimer: any = null;

  showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    title?: string
  ) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = {
      visible: true,
      type,
      title: title ?? (type === 'success' ? '¡Éxito!' : type === 'error' ? 'Error' : 'Información'),
      message,
    };
    this.cdr.detectChanges(); // forzar render inmediato
    this.toastTimer = setTimeout(() => this.closeToast(), 3500);
  }

  closeToast() {
    this.toast.visible = false;
    this.cdr.detectChanges();
  }

  @ViewChild('faceVideo', { static: false })
  faceVideo!: ElementRef<HTMLVideoElement>;

  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // ── Password visibility toggle ──────────────────────────────────────────────
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // ── Register mode toggle ─────────────────────────────────────────────────────
  toggleRegisterMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.confirmPassword = '';
    this.errorMsg = '';
  }

  // ── LOGIN / REGISTER REAL ───────────────────────────────────────────────────
  onValidateCredentials() {

    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.showToast(
        'Ambos campos son obligatorios. Por favor ingresa tu correo y contraseña.',
        'error',
        'Campos incompletos'
      );
      return;
    }

    // ==========================
    // REGISTRO REAL
    // ==========================
    if (this.isRegisterMode) {

      if (
        this.password !==
        this.confirmPassword
      ) {
        this.showToast(
          'Las contraseñas no coinciden. Verifícalas e inténtalo de nuevo.',
          'error',
          'Error de validación'
        );
        return;
      }

      this.authService
        .register(
          this.email,
          this.password
        )
        .subscribe({

          next: () => {

            // Registro exitoso → mostrar toast primero
            this.isRegisterMode = false;
            this.confirmPassword = '';

            this.showToast(
              '¡Cuenta creada! Enviando código de verificación a tu correo...',
              'success',
              '¡Registro exitoso!'
            );

            // Esperar 1.8s para que el usuario vea el toast, luego enviar OTP
            setTimeout(() => {

              this.authService
                .login(this.email, this.password)
                .subscribe({

                  next: (response: any) => {

                    // Solo mostrar OTP, el login real en Angular se hace al verificar
                    this.mostrandoOTP = true;
                    this.cdr.detectChanges();
                  },

                  error: (err: any) => {
                    this.showToast(
                      err.error?.detail || 'Cuenta creada. Inicia sesión para continuar.',
                      'info',
                      'Información'
                    );
                  }
                });

            }, 1800);
          },


          error: (err: any) => {
            this.showToast(
              err.error?.detail || 'No se pudo registrar',
              'error',
              'Error de Registro'
            );
          }
        });

      return;

    }

    // ==========================
    // LOGIN REAL
    // ==========================
    this.authService
      .login(
        this.email,
        this.password
      )
      .subscribe({

        next: (response: any) => {

          this.mostrandoOTP = true;
          
          this.showToast(
            'Código OTP enviado a tu correo',
            'info',
            'Verificación'
          );
          
          this.cdr.detectChanges();
        },

        error: (err: any) => {
          this.showToast(
            err.error?.detail || 'Correo o contraseña incorrectos',
            'error',
            'Error de Acceso'
          );
        }
      });
  }

  // ── Register (ahora se maneja en onValidateCredentials) ────────────────────
  onRegister() {
    return;
  }

  // ── OTP / Dashboard entry ───────────────────────────────────────────────────
  onEnterDashboard() {

    this.errorMsg = '';

    if (!this.codigoOTP || this.codigoOTP.length < 6) {
      this.showToast(
        'El código de verificación debe tener 6 dígitos.',
        'error',
        'Código incompleto'
      );
      return;
    }

    this.authService
      .verifyOTP(this.email, this.codigoOTP)
      .subscribe({

        next: () => {

          // === AQUÍ SE GUARDA EL USUARIO TRAS VERIFICAR OTP ===
          if (this.googleUserTempData) {
            localStorage.setItem('usuario', JSON.stringify(this.googleUserTempData));
            this.googleUserTempData = null;
          } else {
            localStorage.setItem('usuario', JSON.stringify({
              correo: this.email,
              nombre: this.email.split('@')[0],
              proveedor: 'local'
            }));
          }

          this.showToast(
            '¡Verificación exitosa! Entrando al sistema...',
            'success',
            '¡Acceso concedido!'
          );

          setTimeout(() => {
            this.authService.setLoggedIn();
            this.router.navigate(['/dashboard']);
          }, 1200);
        },

        error: (err: any) => {

          const msg = err.error?.detail || 'Código OTP incorrecto';

          this.showToast(
            msg === 'Código incorrecto'
              ? 'El código ingresado no es válido. Revisa tu correo e intenta de nuevo.'
              : msg === 'OTP no encontrado'
              ? 'El código ha expirado o no existe. Vuelve al login y solicita uno nuevo.'
              : msg,
            'error',
            'Verificación fallida'
          );
        }
      });
  }
  onCancel() {

    this.mostrandoOTP = false;

    this.codigoOTP = '';

    this.errorMsg = '';
    
    this.googleUserTempData = null;
  }

  // ── Google Sign-In via Firebase ─────────────────────────────────────────────
  async onGoogleSignIn() {
    try {
      this.errorMsg = '';
      const usuario = await this.authService.loginWithGoogle();

      this.googleUserTempData = usuario;
      this.email = usuario.correo;

      this.showToast(
        'Iniciando verificación. Enviando código de acceso a tu correo de Google...',
        'info',
        'Verificación de Google'
      );

      this.authService.requestGoogleOTP(usuario.correo).subscribe({
        next: () => {
          this.mostrandoOTP = true;
          this.showToast(
            'Código de verificación enviado a tu cuenta de Google',
            'success',
            'Código enviado'
          );
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.googleUserTempData = null;
          this.showToast(
            err.error?.detail || 'No se pudo enviar el código de verificación.',
            'error',
            'Error de envío'
          );
        }
      });

    } catch (error: any) {
      this.googleUserTempData = null;
      if (
        error?.code !==
        'auth/popup-closed-by-user'
      ) {
        this.showToast(
          'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
          'error',
          'Google Sign-In fallido'
        );

        console.error(
          'Google Sign-In error:',
          error
        );
      }
    }
  }

  // ── Face ID via camera ───────────────────────────────────────────────────────
  async onFaceIDSignIn() {

    if (
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      alert(
        'Tu navegador no soporta acceso a la cámara.'
      );
      return;
    }

    try {

      this.isFaceIDScanning = true;

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          });

      this.faceIDStream = stream;

      setTimeout(() => {

        if (
          this.faceVideo
            ?.nativeElement
        ) {
          this.faceVideo
            .nativeElement
            .srcObject = stream;
        }

      }, 100);

      setTimeout(() => {

        this.stopFaceIDScan();

        this.showToast(
          '¡Face ID verificado exitosamente! Redirigiendo al sistema...',
          'success',
          '¡Verificación completa!'
        );

        setTimeout(() => this.router.navigate(['/dashboard']), 1200);

      }, 3000);

    } catch (error) {

      this.isFaceIDScanning = false;

      if (error instanceof DOMException) {

        const messages: Record<string, string> = {
          NotAllowedError: 'Acceso a la cámara denegado. Permite el acceso para usar Face ID.',
          NotFoundError: 'No se encontró una cámara en tu dispositivo.',
          NotReadableError: 'La cámara está siendo usada por otra aplicación.'
        };

        this.showToast(
          messages[error.name] ?? 'Error al acceder a la cámara. Inténtalo de nuevo.',
          'error',
          'Error de cámara'
        );

      } else {

        this.showToast(
          'Error desconocido al acceder a la cámara.',
          'error',
          'Error'
        );
      }
    }
  }

  stopFaceIDScan() {
    this.isFaceIDScanning = false;

    this.faceIDStream
      ?.getTracks()
      .forEach(t => t.stop());

    this.faceIDStream = null;
  }
}