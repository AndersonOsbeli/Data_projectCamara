import { Component, inject, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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

  isFaceIDScanning = false;
  faceIDStream: MediaStream | null = null;

  @ViewChild('faceVideo', { static: false }) faceVideo!: ElementRef<HTMLVideoElement>;

  private authService = inject(AuthService);
  private router = inject(Router);

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

  // ── Credential validation / register ────────────────────────────────────────
  onValidateCredentials() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Por favor ingresa correo y contraseña.';
      return;
    }

    if (this.isRegisterMode) {
      this.onRegister();
      return;
    }

    // Normal login — uses AuthService
    if (this.authService.login(this.email, this.password)) {
      // Simulate OTP flow: show OTP screen
      this.mostrandoOTP = true;
    } else {
      this.errorMsg = 'Credenciales incorrectas (Usa: admin@admin.com / admin123).';
    }
  }

  onRegister() {
    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      return;
    }
    // Stub: in a real app you'd call a register API here
    alert(`Cuenta creada para ${this.email}. Ahora puedes iniciar sesión.`);
    this.toggleRegisterMode();
  }

  // ── OTP / Dashboard entry ───────────────────────────────────────────────────
  onEnterDashboard() {
    this.errorMsg = '';
    if (!this.codigoOTP || this.codigoOTP.length < 6) {
      this.errorMsg = 'Ingresa el código de 6 dígitos.';
      return;
    }
    // Stub: accept any 6-digit code for demo purposes
    this.router.navigate(['/dashboard']);
  }

  onCancel() {
    this.mostrandoOTP = false;
    this.codigoOTP = '';
    this.errorMsg = '';
  }

  // ── Google Sign-In via Firebase ─────────────────────────────────────────────
  async onGoogleSignIn() {
    try {
      await this.authService.loginWithGoogle();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      // User closed the popup or other error
      if (error?.code !== 'auth/popup-closed-by-user') {
        this.errorMsg = 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.';
        console.error('Google Sign-In error:', error);
      }
    }
  }

  // ── Face ID via camera ───────────────────────────────────────────────────────
  async onFaceIDSignIn() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no soporta acceso a la cámara.');
      return;
    }

    try {
      this.isFaceIDScanning = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      this.faceIDStream = stream;

      // Assign stream once the view renders the <video> element
      setTimeout(() => {
        if (this.faceVideo?.nativeElement) {
          this.faceVideo.nativeElement.srcObject = stream;
        }
      }, 100);

      // Simulate scan for 3 seconds then navigate
      setTimeout(() => {
        this.stopFaceIDScan();
        alert('¡Face ID verificado exitosamente!');
        this.router.navigate(['/dashboard']);
      }, 3000);

    } catch (error) {
      this.isFaceIDScanning = false;

      if (error instanceof DOMException) {
        const messages: Record<string, string> = {
          NotAllowedError: 'Acceso a la cámara denegado. Permite el acceso para usar Face ID.',
          NotFoundError: 'No se encontró una cámara en tu dispositivo.',
          NotReadableError: 'La cámara está siendo usada por otra aplicación.'
        };
        alert(messages[error.name] ?? 'Error al acceder a la cámara. Inténtalo de nuevo.');
      } else {
        alert('Error desconocido al acceder a la cámara.');
      }
    }
  }

  stopFaceIDScan() {
    this.isFaceIDScanning = false;
    this.faceIDStream?.getTracks().forEach(t => t.stop());
    this.faceIDStream = null;
  }
}
