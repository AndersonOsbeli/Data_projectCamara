import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-cameras',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cameras.html',
  styleUrls: ['./cameras.scss']
})
export class Cameras implements OnInit, OnDestroy {
  // --- INYECCIONES NATIVAS DE ANGULAR ---
  private http: HttpClient = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private privateApiUrl = 'http://127.0.0.1:8000/api';

  // --- URL DE TRANSMISIÓN DE VIDEO PARA EL [src] DEL HTML ---
  streamUrl = 'http://127.0.0.1:8000/api/camera/stream';

  // --- VARIABLES DE ESTADO HARDWARE EXIGIDAS POR TU TEMPLATE ---
  isCameraRunning = false;
  isDetectionRunning = false;
  lugarActual = 'Cámara Principal';
  nuevoLugarInput = '';

  // Configuración de fuentes (Cámara PC vs DroidCam)
  cameraType: 'local' | 'ip' = 'local';
  ipAddress = 'http://192.168.1.100:4747/video'; // Valor por defecto

  // 🚀 INTERRUPTORES LOGICOS ASOCIADOS A LOS COMPORTAMIENTOS DEL HTML
  get cameraRunning(): boolean { return this.isCameraRunning; }
  set cameraRunning(value: boolean) { this.isCameraRunning = value; }

  get detectionRunning(): boolean { return this.isDetectionRunning; }
  set detectionRunning(value: boolean) { this.isDetectionRunning = value; }

  get locationInput(): string { return this.nuevoLugarInput; }
  set locationInput(value: string) { this.nuevoLugarInput = value; }

  get currentLocation(): string { return this.lugarActual; }

  // --- PIPELINE DE REGISTROS ANALÍTICOS (TABLAS Y FEEDS) ---
  registrosRecientes: any[] = [];
  get recentRegistros(): any[] { return this.registrosRecientes; }

  // --- SISTEMA DE PAGINACIÓN NATIVA DEL CLIENTE ---
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  get paginatedRegistros(): any[] {
    if (!this.registrosRecientes || this.registrosRecientes.length === 0) return [];
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.registrosRecientes.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // --- CONTROL DE TEMPORIZADORES (POLLING ASÍNCRONO) ---
  private statusInterval: any = null;
  private registrosInterval: any = null;

  ngOnInit(): void {
    this.checkStatus();
    this.cargarRegistrosRecientes();

    // Polling ordenado: previene que se encallen las peticiones de red
    this.statusInterval = setInterval(() => this.checkStatus(), 2000);
    this.registrosInterval = setInterval(() => this.cargarRegistrosRecientes(), 1500);
  }

  ngOnDestroy(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);
    if (this.registrosInterval) clearInterval(this.registrosInterval);
  }

  // =======================================================
  // 🚀 FLUJO DE DATOS Y CONEXIÓN CON EL SERVIDOR PYTHON
  // =======================================================
  async checkStatus() {
    this.http.get(`${this.privateApiUrl}/camera/status`).subscribe({
      next: (res: any) => {
        this.isCameraRunning = res.camera_running;
        this.isDetectionRunning = res.detection_running;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[SENTINEL IA]: Error leyendo telemetría de estados:', err);
      }
    });

    this.http.get(`${this.privateApiUrl}/camera/location`).subscribe({
      next: (res: any) => {
        this.lugarActual = res.lugar || 'Cámara Principal';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[SENTINEL IA]: Error leyendo metadatos de lugar:', err);
      }
    });
  }

  cargarRegistrosRecientes() {
    this.http.get(`${this.privateApiUrl}/registros/recent?limit=50`).subscribe({
      next: (res: any) => {
        this.registrosRecientes = res || [];
        // Actualizar total de páginas dinámicamente según volumen de transacciones
        this.totalPages = Math.max(1, Math.ceil(this.registrosRecientes.length / this.itemsPerPage));
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[SENTINEL IA]: Error de actualización de tablas:', err);
      }
    });
  }

  // =======================================================
  // 🚀 CONTROL INTERACTIVO DE ACCIONES DE LA PLANTILLA
  // =======================================================
 async toggleDetection() {
    // 🚀 Determinamos explícitamente qué acción queremos ejecutar en el backend
    // Si la IA está corriendo, le mandamos 'stop'. Si está apagada, le mandamos 'start'.
    const accionDefinida = this.isDetectionRunning ? 'stop' : 'start';
    console.log(`[CONTROL DASHBOARD]: Solicitando acción explícita: ${accionDefinida}`);

    this.http.post(`${this.privateApiUrl}/camera/toggle`, { action: accionDefinida }).subscribe({
      next: (res: any) => {
        this.isCameraRunning = res.camera_running;
        this.isDetectionRunning = res.detection_running;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[IA_CONTROL]: Error en switch de inferencia:', err);
      }
    });
  }

  async updateLocation() {
    if (!this.nuevoLugarInput || !this.nuevoLugarInput.trim()) return;
    const lugarLimpio = this.nuevoLugarInput.trim();

    this.http.post(`${this.privateApiUrl}/camera/location`, { lugar: lugarLimpio }).subscribe({
      next: (res: any) => {
        this.lugarActual = res.lugar;
        this.nuevoLugarInput = ''; // Vacía el input tras registrar con éxito
        this.checkStatus();
        this.cargarRegistrosRecientes();
      },
      error: (err: any) => {
        console.error('[IA_CONTROL]: Error propagando nueva locación en caliente:', err);
      }
    });
  }

  async changeCameraSource() {
    // 🚀 DETERMINACIÓN DE FUENTE: Mapea si usas la cámara local (0) o el stream IP de DroidCam
    const sourceValue = this.cameraType === 'local' ? '0' : this.ipAddress;
    console.log(`[HARDWARE]: Solicitando enlace a recurso: ${sourceValue}`);

    this.http.post(`${this.privateApiUrl}/camera/source`, { source: sourceValue }).subscribe({
      next: (res: any) => {
        // Al modificar la fuente, refrescamos estados de inmediato
        this.checkStatus();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[HARDWARE_ERROR]: No se pudo conmutar la fuente de captura:', err);
      }
    });
  }

  // Controlador de cambio de página de tu tabla baja
  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.cdr.detectChanges();
    }
  }
}