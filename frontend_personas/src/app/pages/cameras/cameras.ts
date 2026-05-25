import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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
  
  // 🚀 INYECCIONES DE DEPENDENCIAS STANDALONE MODERNAS
  private http = inject(HttpClient) as any;
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  recentRegistros: Registro[] = [];
  paginatedRegistros: Registro[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  private pollInterval: any;

  // 🚀 CONSTRUCTOR LIMPIO (Sin variables duplicadas para evitar errores TS)
  constructor() {}

  ngOnInit() {
    this.refreshStreamUrl();
    this.checkStatus();
    this.startPolling();
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
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

    this.http.post(`${this.apiUrl}/camera/source`, { source }).subscribe({
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
    this.http.get(`${this.apiUrl}/camera/status`).subscribe({
      next: res => { this.detectionRunning = res.detection_running; this.cdr.detectChanges(); },
      error: err => console.error('Status error:', err)
    });
    this.http.get(`${this.apiUrl}/camera/location`).subscribe({
      next: res => { this.currentLocation = res.lugar; this.locationInput = res.lugar; this.cdr.detectChanges(); },
      error: err => console.error('Location error:', err)
    });
  }

  updateLocation() {
    if (!this.locationInput.trim()) return;
    this.http.post(`${this.apiUrl}/camera/location`, { lugar: this.locationInput }).subscribe({
      next: res => { this.currentLocation = res.lugar; this.cdr.detectChanges(); },
      error: err => console.error('Update location error:', err)
    });
  }

  toggleDetection() {
    this.detectionRunning = !this.detectionRunning;
    this.http.post(`${this.apiUrl}/camera/toggle`, {}).subscribe({
      next: res => { this.detectionRunning = res.detection_running; this.cdr.detectChanges(); },
      error: err => { this.detectionRunning = !this.detectionRunning; console.error(err); this.cdr.detectChanges(); }
    });
  }

  startPolling() {
    this.fetchRecentRegistros();
    this.pollInterval = setInterval(() => this.fetchRecentRegistros(), 3000);
  }

  fetchRecentRegistros() {
    this.http.get(`${this.apiUrl}/registros/recent?limit=50`).subscribe({
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