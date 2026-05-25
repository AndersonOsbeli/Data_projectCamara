import { Component, inject, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  // --- VARIABLES DE FORMULARIO ---
  email = '';
  password = '';
  confirmPassword = '';
  codigoOTP = '';
  errorMsg = '';

  // --- VARIABLES DE ESTADO LÓGICO ---
  showPassword = false;
  isRegisterMode = false;
  mostrandoOTP = false;
  googleUserTempData: any = null;

  // --- VARIABLES ASOCIADAS A FACE ID ---
  isFaceIDScanning = false;
  faceIDStream: MediaStream | null = null;

  // --- INYECCIONES STANDALONE ---
  private http: any = inject(HttpClient); 
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // --- CONTROL DE NOTIFICACIONES (TOAST) ---
  toast = {
    visible: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: '',
  };
  private toastTimer: any = null;

  @ViewChild('faceVideo', { static: false }) faceVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas', { static: false }) faceCanvas!: ElementRef<HTMLCanvasElement>;

  constructor() {
    console.log('[SYSTEM]: Componente Login inicializado correctamente.');
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = {
      visible: true,
      type,
      title: title ?? (type === 'success' ? '¡Éxito!' : type === 'error' ? 'Error' : 'Información'),
      message,
    };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => this.closeToast(), 3500);
  }

  closeToast() {
    this.toast.visible = false;
    this.cdr.detectChanges();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();
  }

  toggleRegisterMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.confirmPassword = '';
    this.errorMsg = '';
    this.email = '';
    this.password = '';
    console.log('[ACTION]: Conmutando vista. ¿Modo registro?:', this.isRegisterMode);
    this.cdr.detectChanges();
  }

  // 🚀 INTERCEPTOR DEL DOM: Resuelve el problema del doble clic capturando valores nativos al instante
  onValidateCredentialsDirect(txtEmail: string, txtPass: string, txtConfirm: string) {
    console.log('[DOM-EVENT]: Click detectado de forma síncrona.');
    
    this.email = txtEmail ? txtEmail.trim() : '';
    this.password = txtPass ? txtPass.trim() : '';
    this.confirmPassword = txtConfirm ? txtConfirm.trim() : '';

    if (!this.email || !this.password) {
      this.showToast('El correo y la contraseña son obligatorios.', 'error', 'Campos incompletos');
      return;
    }

    // Enviamos los datos puros por parámetros para saltarnos el lag de asignación asíncrona de variables
    this.ejecutarFlujoAutenticacion(this.email, this.password, this.confirmPassword);
  }

  // 🚀 MOTOR DE AUTENTICACIÓN: Procesa las peticiones HTTP limpias al backend
  private ejecutarFlujoAutenticacion(correo: string, pass: string, confirm: string) {
    if (this.isRegisterMode) {
      if (pass !== confirm) {
        this.showToast('Las contraseñas ingresadas no coinciden.', 'error', 'Validación fallida');
        return;
      }

      this.showToast('Registrando tus credenciales en el servidor...', 'info', 'Procesando...');

      this.http.post('http://127.0.0.1:8000/api/register', {
        correo: correo,
        password: pass
      }).subscribe({
        next: (res: any) => {
          console.log('[BACKEND]: Usuario inyectado con éxito en SQL Server.', res);
          this.showToast('¡Cuenta creada! Se ha despachado un código OTP de seguridad.', 'success', '¡Registro Exitoso!');
          
          this.isRegisterMode = false;
          this.confirmPassword = '';

          // Disparar login automático para generar el OTP del usuario recién creado
          setTimeout(() => {
            this.http.post('http://127.0.0.1:8000/api/login', { correo: correo, password: pass }).subscribe({
              next: () => {
                this.mostrandoOTP = true;
                this.cdr.detectChanges();
              },
              error: (err: any) => {
                console.error('[AUTH_ERROR]: Falló el login automático post-registro:', err);
                this.showToast('Tu cuenta está lista. Por favor ingresa tus datos en el Login tradicional.', 'info');
              }
            });
          }, 1200);
        },
        error: (err: any) => {
          console.error('[SERVER_ERROR]: Registro rechazado:', err);
          this.showToast(err.error?.detail || 'No se pudo crear la cuenta de usuario.', 'error', 'Error de Registro');
        }
      });

    } else {
      console.log('[BACKEND]: Solicitando envío de token OTP al correo...');
      
      this.http.post('http://127.0.0.1:8000/api/login', { correo: correo, password: pass }).subscribe({
        next: () => {
          this.mostrandoOTP = true;
          this.showToast('Código de seguridad enviado a tu buzón.', 'success', 'Verificación');
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('[AUTH_ERROR]: Acceso denegado:', err);
          this.showToast(err.error?.detail || 'Credenciales inválidas.', 'error', 'Error de Acceso');
        }
      });
    }
  }

  onEnterDashboard() {
    if (!this.codigoOTP || this.codigoOTP.length < 6) {
      this.showToast('El token de seguridad debe tener 6 caracteres.', 'error', 'Formato Inválido');
      return;
    }

    this.authService.verifyOTP(this.email, this.codigoOTP).subscribe({
      next: () => {
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

        this.showToast('Código OTP verificado. Abriendo panel analítico...', 'success', 'Acceso Concedido');
        this.authService.setLoggedIn();

        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1200);
      },
      error: (err: any) => {
        this.showToast(err.error?.detail || 'El código ingresado es incorrecto o ya expiró.', 'error', 'Verificación fallida');
      }
    });
  }

  onCancel() {
    this.mostrandoOTP = false;
    this.codigoOTP = '';
    this.googleUserTempData = null;
    this.cdr.detectChanges();
  }

  async onGoogleSignIn() {
    try {
      const usuario = await this.authService.loginWithGoogle();
      this.googleUserTempData = usuario;
      this.email = usuario.correo;

      this.showToast('Autenticación federada exitosa. Generando token OTP...', 'info', 'Google Sign-In');

      this.authService.requestGoogleOTP(usuario.correo).subscribe({
        next: () => {
          this.mostrandoOTP = true;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.googleUserTempData = null;
          this.showToast(err.error?.detail || 'No se pudo despachar el código OTP de Google.', 'error');
        }
      });
    } catch (error: any) {
      this.googleUserTempData = null;
      if (error?.code !== 'auth/popup-closed-by-user') {
        this.showToast('Inicio de sesión con Google interrumpido por el cliente.', 'error');
      }
    }
  }

 // 🚀 OPTIMIZADO: Ahora recibe el string directo del HTML único
  onFaceIDAction(txtEmail?: string) {
    // Si viene un valor del DOM, lo sincronizamos síncronamente en la clase
    if (txtEmail) {
      this.email = txtEmail.trim();
    }

    if (this.isRegisterMode) {
      this.showToast(
        'Para registrar tu rostro, primero crea tu cuenta tradicional. Una vez dentro del sistema podrás asociar tu Face ID.', 
        'info', 
        'Flujo de Enrolamiento'
      );
    } else {
      // Validamos el estado real del string ya sincronizado
      if (!this.email) {
        this.showToast(
          'Necesitamos tu correo para extraer la plantilla matemática de la base de datos.', 
          'error', 
          'Escribe tu correo primero'
        );
        return;
      }
      console.log('[BIOMETRIA]: Correo validado. Iniciando captura de video para:', this.email);
      this.startFaceIDScan('login');
    }
  }

  async startFaceIDScan(tipo: 'login' | 'register') {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.showToast('Tu navegador carece de capacidades para interactuar con cámaras de video.', 'error', 'Hardware Ausente');
      return;
    }

    try {
      this.isFaceIDScanning = true;
      this.cdr.detectChanges();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      this.faceIDStream = stream;

      setTimeout(() => {
        if (this.faceVideo?.nativeElement) {
          this.faceVideo.nativeElement.srcObject = stream;
        }
      }, 200);

      // Disparo automático de análisis de facciones a los 3 segundos
      setTimeout(() => {
        this.captureAndProcessFace(tipo);
      }, 3000);

    } catch (error) {
      this.isFaceIDScanning = false;
      this.cdr.detectChanges();
      this.showToast('No se pudo inicializar la transmisión del hardware de video.', 'error', 'Periférico Bloqueado');
    }
  }

  captureAndProcessFace(tipo: 'login' | 'register') {
    const video = this.faceVideo?.nativeElement;
    const canvas = this.faceCanvas?.nativeElement;
    const context = canvas?.getContext('2d');

    if (video && canvas && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg');
      this.stopFaceIDScan();

      const payload = { correo: this.email, image_base64: base64Image };
      const urlEndpoint = tipo === 'register' ? '/api/register-face' : '/api/login-face';

      this.showToast('Analizando coincidencia vectorial de rasgos con OpenCV...', 'info', 'Buscando Coincidencia');

      this.http.post(`http://127.0.0.1:8000${urlEndpoint}`, payload).subscribe({
        next: (res: any) => {
          this.showToast(res.message, 'success', 'Firma Biométrica Válida');
          
          if (tipo === 'login') {
            localStorage.setItem('usuario', JSON.stringify({
              correo: this.email,
              nombre: res.nombre || this.email.split('@')[0],
              proveedor: 'faceid'
            }));

            setTimeout(() => {
              this.authService.setLoggedIn();
              this.router.navigate(['/dashboard']);
            }, 1200);
          } else {
            this.isRegisterMode = false;
            this.cdr.detectChanges();
          }
        },
        error: (err: any) => {
          console.error('[BIOMETRIC_ERROR]: Error de comparación:', err);
          this.showToast(err.error?.detail || 'El rostro no coincide con las firmas registradas en SQL Server.', 'error', 'Acceso Denegado');
        }
      });
    }
  }

  stopFaceIDScan() {
    this.isFaceIDScanning = false;
    if (this.faceIDStream) {
      this.faceIDStream.getTracks().forEach(track => track.stop());
    }
    this.faceIDStream = null;
    this.cdr.detectChanges();
  }
}