import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface Registro {
  id_registro: string;
  clase: string;
  genero: string;
  fecha: string;
  hora: string;
  lugar: string;
}

@Component({
  selector: 'app-cameras',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule],
  templateUrl: './cameras.html',
  styleUrls: ['./cameras.scss'],
})
export class Cameras implements OnInit, OnDestroy {
  private http: HttpClient = inject(HttpClient);
  private sanitizer: DomSanitizer = inject(DomSanitizer);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  cameraRunning = true;
  detectionRunning = false;
  streamUrl: SafeUrl = '';
  currentLocation: string = '';
  locationInput: string = '';

  // Fuente de video
  cameraType: 'local' | 'ip' = 'local';
  ipAddress: string = 'http://192.168.1.15:4747/video';

  private baseStreamUrl = 'http://localhost:8000/api/camera/stream';
  private apiUrl = 'http://localhost:8000/api';

  recentRegistros: Registro[] = [];
  paginatedRegistros: Registro[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  private pollInterval: any;

  ngOnInit() {
    // NO activar automáticamente. El usuario debe hacer clic en "Conectar"
    this.checkStatus();
    this.startPolling();
  }

  ngOnDestroy() {
    // 🚀 AL SALIR DEL MÓDULO, DESACTIVAR CÁMARA PARA LIBERAR RECURSO
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.stopCamera();
  }

  stopCamera() {
    if (this.cameraRunning) {
      this.http.post<any>(`${this.apiUrl}/camera/stop`, {}).subscribe({
        next: () => {
          this.cameraRunning = false;
          this.cdr.detectChanges();
          console.log('[CAMERA]: Cámara desactivada');
        },
        error: (err) => console.error('[CAMERA ERROR]:', err)
      });
    }
  }

  activateCameraManual() {
    // 🚀 ACTIVAR CÁMARA MANUALMENTE CUANDO EL USUARIO LO REQUIERA
    this.http.post<any>(`${this.apiUrl}/camera/start`, {}).subscribe({
      next: (res) => {
        this.cameraRunning = res.camera_running;
        this.refreshStreamUrl();
        this.cdr.detectChanges();
        console.log('[CAMERA]: Cámara conectada manualmente');
      },
      error: (err) => {
        console.error('[CAMERA ERROR]: No se pudo conectar:', err);
      }
    });
  }

  refreshStreamUrl() {
    this.streamUrl = this.sanitizer.bypassSecurityTrustUrl(
      `${this.baseStreamUrl}?t=${Date.now()}`
    );
  }

  changeCameraSource() {
    const source = this.cameraType === 'local' ? '0' : this.ipAddress;
    this.cameraRunning = false;
    this.cdr.detectChanges();

    this.http.post<any>(`${this.apiUrl}/camera/source`, { source }).subscribe({
      next: () => {
        setTimeout(() => {
          this.cameraRunning = true;
          this.refreshStreamUrl();
          this.cdr.detectChanges();
        }, 1200);
      },
      error: err => {
        this.cameraRunning = true;
        console.error('Error changing source:', err);
        this.cdr.detectChanges();
      }
    });
  }

  checkStatus() {
    this.http.get<any>(`${this.apiUrl}/camera/status`).subscribe({
      next: res => { this.detectionRunning = res.detection_running; this.cdr.detectChanges(); },
      error: err => console.error('Status error:', err)
    });
    this.http.get<any>(`${this.apiUrl}/camera/location`).subscribe({
      next: res => { this.currentLocation = res.lugar; this.locationInput = res.lugar; this.cdr.detectChanges(); },
      error: err => console.error('Location error:', err)
    });
  }

  updateLocation() {
    if (!this.locationInput.trim()) return;
    // 🚀 AL GUARDAR UBICACIÓN, PREPARA LA DETECCIÓN DE GÉNERO
    this.http.post<any>(`${this.apiUrl}/camera/location`, { lugar: this.locationInput }).subscribe({
      next: res => {
        this.currentLocation = res.lugar;
        // Llamar al endpoint de preparar detección después de guardar ubicación
        this.http.post<any>(`${this.apiUrl}/camera/prepare-gender-detection`, { lugar: res.lugar }).subscribe({
          next: () => {
            console.log('[DETECTION]: Detección de género preparada para ubicación:', res.lugar);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.log('[INFO]: Ubicación guardada (preparación de género en background)');
            this.cdr.detectChanges();
          }
        });
      },
      error: err => console.error('Update location error:', err)
    });
  }

  toggleDetection() {
    // 🚀 SOLO ACTIVA/DESACTIVA LA DETECCIÓN DE GÉNERO, NO LA CÁMARA
    const action = this.detectionRunning ? 'stop-gender' : 'start-gender';
    this.detectionRunning = !this.detectionRunning;
    
    this.http.post<any>(`${this.apiUrl}/camera/toggle-gender`, { action }).subscribe({
      next: res => { 
        this.detectionRunning = res.detection_running; 
        this.cdr.detectChanges(); 
        console.log('[DETECTION]:', action === 'start-gender' ? 'Detección de género INICIADA' : 'Detección de género DETENIDA');
      },
      error: err => { 
        this.detectionRunning = !this.detectionRunning; 
        console.error('Error toggling gender detection:', err); 
        this.cdr.detectChanges(); 
      }
    });
  }

  startPolling() {
    this.fetchRecentRegistros();
    this.pollInterval = setInterval(() => this.fetchRecentRegistros(), 3000);
  }

  fetchRecentRegistros() {
    this.http.get<Registro[]>(`${this.apiUrl}/registros/recent?limit=50`).subscribe({
      next: data => {
        this.recentRegistros = data;
        this.totalPages = Math.ceil(data.length / this.itemsPerPage) || 1;
        this.updatePaginatedData();
      },
      error: err => console.error('Fetch error:', err)
    });
  }

  updatePaginatedData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedRegistros = this.recentRegistros.slice(start, start + this.itemsPerPage);
    this.cdr.detectChanges();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }
}