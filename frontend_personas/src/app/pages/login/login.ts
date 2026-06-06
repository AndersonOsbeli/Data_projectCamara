import { Component, inject, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { FaceMesh } from '@mediapipe/face_mesh'; // 🚀 Importación de MediaPipe Web

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit, OnDestroy {
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
  rostroHolograficoUrl: string | null = null;
  mostrarCamaraEnVivo = true;
  
  private animationFrameId: number | null = null;
  private faceMesh!: FaceMesh; // Instancia del detector protegida

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

  // 🚀 CONSTRUCTOR LIMPIO: Protege al servidor de Node/Vite en el arranque
  constructor() {
    console.log('[SYSTEM]: Componente Login Full Stack inicializado.');
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopFaceIDScan();
  }

  // 🚀 ESCUDO SSR: Inicialización perezosa ejecutada únicamente en el cliente (Browser)
  private inicializarMediaPipeWeb() {
    if (typeof window === 'undefined') return;

    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.4,
      minTrackingConfidence: 0.4
    });

    this.faceMesh.onResults((results) => {
      this.dibujarMallaEnVivo(results);
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { visible: true, type, title: title ?? 'Notificación', message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => this.closeToast(), 3500);
  }

  closeToast() { this.toast.visible = false; this.cdr.detectChanges(); }
  togglePasswordVisibility() { this.showPassword = !this.showPassword; this.cdr.detectChanges(); }
  
  toggleRegisterMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.confirmPassword = ''; this.email = ''; this.password = '';
    this.cdr.detectChanges();
  }

  onValidateCredentialsDirect(txtEmail: string, txtPass: string, txtConfirm: string) {
    this.email = txtEmail ? txtEmail.trim() : '';
    this.password = txtPass ? txtPass.trim() : '';
    this.confirmPassword = txtConfirm ? txtConfirm.trim() : '';

    if (!this.email || !this.password) {
      this.showToast('El correo y la contraseña son obligatorios.', 'error', 'Campos incompletos');
      return;
    }
    this.ejecutarFlujoAutenticacion(this.email, this.password, this.confirmPassword);
  }

  private ejecutarFlujoAutenticacion(correo: string, pass: string, confirm: string) {
    if (this.isRegisterMode) {
      if (pass !== confirm) {
        this.showToast('Las contraseñas no coinciden.', 'error', 'Validación fallida');
        return;
      }
      this.http.post('http://127.0.0.1:8000/api/register', { correo, password: pass }).subscribe({
        next: () => {
          this.isRegisterMode = false;
          this.showToast('¡Cuenta creada! Redirigiendo a verificación OTP.', 'success');
          this.mostrandoOTP = true;
          this.cdr.detectChanges();
        },
        error: (err: any) => this.showToast(err.error?.detail || 'Error de Registro', 'error')
      });
    } else {
      this.http.post('http://127.0.0.1:8000/api/login', { correo, password: pass }).subscribe({
        next: () => { this.mostrandoOTP = true; this.cdr.detectChanges(); },
        error: (err: any) => this.showToast('Credenciales incorrectas.', 'error')
      });
    }
  }

  onEnterDashboard() {
    if (!this.codigoOTP || this.codigoOTP.length < 6) return;
    this.authService.verifyOTP(this.email, this.codigoOTP).subscribe({
      next: () => {
        localStorage.setItem('usuario', JSON.stringify({ correo: this.email, proveedor: 'local' }));
        this.authService.setLoggedIn();
        this.router.navigate(['/dashboard']);
      },
      error: () => this.showToast('Token inválido.', 'error')
    });
  }

  onCancel() { this.mostrandoOTP = false; this.codigoOTP = ''; this.cdr.detectChanges(); }

  async onGoogleSignIn() {
    try {
      const usuario = await this.authService.loginWithGoogle();
      this.email = usuario.correo;
      this.mostrandoOTP = true;
      this.cdr.detectChanges();
    } catch (error) { this.showToast('Google Sign-In interrumpido.', 'error'); }
  }

  // =================================================================
  // 🚀 ACCIÓN PRINCIPAL DE ESCANEO DE ROSTRO
  // =================================================================
  onFaceIDAction(txtEmail?: string) {
    if (txtEmail) this.email = txtEmail.trim();
    if (!this.email) {
      this.showToast('Necesitamos tu correo para extraer la firma biométrica.', 'error', 'Escribe tu correo primero');
      return;
    }
    this.startFaceIDScan('login');
  }

  async startFaceIDScan(tipo: 'login' | 'register') {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      this.rostroHolograficoUrl = null;
      this.mostrarCamaraEnVivo = true;
      this.isFaceIDScanning = true;
      this.cdr.detectChanges();

      // 🛡️ INYECCIÓN SEGURA DEL MODELO: Solo se ejecuta del lado del cliente al encender la cámara
      if (!this.faceMesh) {
        console.log('[BIOMETRIA]: Inicializando MediaPipe seguro en entorno cliente...');
        this.inicializarMediaPipeWeb();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      this.faceIDStream = stream;

      setTimeout(() => {
        if (this.faceVideo?.nativeElement) {
          this.faceVideo.nativeElement.srcObject = stream;
          this.loopEnvioFramesAMediaPipe();
        }
      }, 300);

      // Disparo automático del análisis final al backend después de 4 segundos de tracking en vivo
      setTimeout(() => {
        this.captureAndProcessFace(tipo, this.email);
      }, 4000);

    } catch (error) {
      this.isFaceIDScanning = false;
      this.cdr.detectChanges();
    }
  }

  private async loopEnvioFramesAMediaPipe() {
    if (!this.isFaceIDScanning || !this.mostrarCamaraEnVivo) return;
    
    const video = this.faceVideo?.nativeElement;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && this.faceMesh) {
      await this.faceMesh.send({ image: video });
    }
    this.animationFrameId = requestAnimationFrame(() => this.loopEnvioFramesAMediaPipe());
  }

  // 🚀 RENDERIZADO EN CALIENTE DE LA DETECCIÓN FACIAL
  private dibujarMallaEnVivo(results: any) {
    const video = this.faceVideo?.nativeElement;
    const canvas = this.faceCanvas?.nativeElement;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ajustes estéticos Cyberpunk (Líneas finas azul neón glossy)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 0.8;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];

      // --- CONFIGURACIÓN ESTÉTICA NEÓN ---
      ctx.fillStyle = '#00e5ff'; // Azul cian brillante para los nodos
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)'; // Líneas semi-transparentes para la red
      ctx.lineWidth = 0.8;

      // 1. DIBUJAR TODOS LOS PUNTOS FACIALES INDIVIDUALES
      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i];
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;

        ctx.beginPath();
        // Dibujar pequeños círculos para los puntos del sensor
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 2. CREAR MALLA DE TRIANGULACIÓN (CONEXIONES INTERNAS)
      // Conectamos puntos adyacentes para armar los polígonos tridimensionales de la máscara
      ctx.beginPath();
      for (let i = 0; i < landmarks.length; i++) {
        // Estructura de interconexión cíclica controlada por saltos geométricos
        if (i % 4 === 0 && i + 4 < landmarks.length) {
          const pt1 = landmarks[i];
          const pt2 = landmarks[i + 2];
          const pt3 = landmarks[i + 4];

          ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
          ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          ctx.lineTo(pt3.x * canvas.width, pt3.y * canvas.height);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // 3. ENMARCAR SECCIONES CLAVE DE EXPRESIÓN (Ojos y Labios)
      // Dibujamos un contorno extra en zonas de alta densidad para dar el efecto analítico
      this.trazarContornoEspecial(ctx, landmarks, [133, 173, 157, 158, 159, 160, 161, 246]); // Ojo izquierdo
      this.trazarContornoEspecial(ctx, landmarks, [362, 398, 384, 385, 386, 387, 388, 466]); // Ojo derecho
      this.trazarContornoEspecial(ctx, landmarks, [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]); // Contorno boca
    }
  }

  // Función auxiliar interna para dar relieve y volumen a los rasgos
  private trazarContornoEspecial(ctx: CanvasRenderingContext2D, landmarks: any[], indices: number[]) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)'; // Neón más intenso para facciones principales
    ctx.lineWidth = 1.2;
    
    for (let i = 0; i < indices.length; i++) {
      const pt = landmarks[indices[i]];
      if (!pt) continue;
      const x = pt.x * ctx.canvas.width;
      const y = pt.y * ctx.canvas.height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  captureAndProcessFace(tipo: 'login' | 'register', emailValidado: string) {
    if (!this.faceVideo || !this.faceCanvas) {
      this.stopFaceIDScan();
      return;
    }

    const videoEl = this.faceVideo.nativeElement;
    const canvasEl = this.faceCanvas.nativeElement;
    const context = canvasEl.getContext('2d');

    if (!context || videoEl.videoWidth <= 0) {
      setTimeout(() => this.captureAndProcessFace(tipo, emailValidado), 500);
      return;
    }

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const fotoBase64 = canvasEl.toDataURL('image/jpeg', 0.85);

    const urlEndpoint = tipo === 'login' ? '/api/login-face' : '/api/register-face';
    const payload = { correo: emailValidado, image_base64: fotoBase64 };

    this.http.post(`http://127.0.0.1:8000${urlEndpoint}`, payload).subscribe({
      next: (res: any) => {
        this.showToast(res.message, 'success', '✓ Autenticación Exitosa');
        
        if (tipo === 'login') {
          this.rostroHolograficoUrl = res.imagen_analitica;
          this.mostrarCamaraEnVivo = false;
          this.cdr.detectChanges();

          if (this.faceIDStream) {
            this.faceIDStream.getTracks().forEach(track => track.stop());
          }

          localStorage.setItem('usuario', JSON.stringify({
            correo: emailValidado,
            nombre: res.nombre || emailValidado.split('@')[0],
            proveedor: 'faceid'
          }));

          setTimeout(() => {
            this.stopFaceIDScan();
            this.authService.setLoggedIn();
            this.router.navigate(['/dashboard']);
          }, 3500);
        }
      },
      error: (err: any) => {
        this.stopFaceIDScan();
        this.showToast('El rostro analizado no coincide con las firmas registradas.', 'error', 'Acceso Denegado');
      }
    });
  }

  stopFaceIDScan() {
    this.isFaceIDScanning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.faceIDStream) {
      this.faceIDStream.getTracks().forEach(track => track.stop());
    }
    this.faceIDStream = null;
    this.mostrarCamaraEnVivo = true;
    this.rostroHolograficoUrl = null;
    this.cdr.detectChanges();
  }
}