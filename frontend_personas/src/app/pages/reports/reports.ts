import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, Registro } from '../../services/data.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports implements OnInit {
  private dataService = inject(DataService);
  private cdr = inject(ChangeDetectorRef);

  allRegistros: Registro[] = [];
  filteredRegistros: Registro[] = [];
  paginatedRegistros: Registro[] = [];
  uniqueLocations: string[] = [];

  // Filters
  searchTerm: string = '';
  filterGender: string = '';
  filterLugar: string = '';
  filterDate: string = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 15;
  totalPages = 1;

  isLoading = true;

  ngOnInit() {
    this.dataService.getRegistros().subscribe({
      next: (data) => {
        // Exclude animals, keep only "persona", then reverse to show newest first
        const personasOnly = data.filter(r => r.clase && r.clase.toLowerCase() === 'persona');
        this.allRegistros = [...personasOnly].reverse();
        
        // Extract unique locations for the dropdown
        const locationsSet = new Set(this.allRegistros.map(r => r.lugar).filter(l => l));
        this.uniqueLocations = Array.from(locationsSet).sort();

        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error fetching records:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    let result = this.allRegistros;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.id_registro && r.id_registro.toLowerCase().includes(term))
      );
    }

    if (this.filterGender) {
      result = result.filter(r => r.genero && r.genero.toLowerCase() === this.filterGender.toLowerCase());
    }

    if (this.filterLugar) {
      result = result.filter(r => r.lugar && r.lugar === this.filterLugar);
    }

    if (this.filterDate) {
      result = result.filter(r => r.fecha === this.filterDate);
    }

    this.filteredRegistros = result;
    this.totalPages = Math.ceil(this.filteredRegistros.length / this.itemsPerPage) || 1;
    this.currentPage = 1; // Reset to first page
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedRegistros = this.filteredRegistros.slice(start, start + this.itemsPerPage);
    this.cdr.detectChanges();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.filterGender = '';
    this.filterLugar = '';
    this.filterDate = '';
    this.applyFilters();
  }

  exportToCSV() {
    if (this.filteredRegistros.length === 0) return;

    const headers = ['ID Registro', 'Fecha', 'Hora', 'Género', 'Lugar'];
    
    // Create CSV rows
    const csvRows = this.filteredRegistros.map(r => {
      return [
        r.id_registro,
        r.fecha,
        r.hora,
        r.genero,
        `"${r.lugar}"` // Handle potential commas in location
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_camara_personas_${date}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Email Report Logic ---
  isEmailModalOpen = false;
  emailDestination = '';
  emailPeriod = '10'; // default period string
  isSendingEmail = false;

  // --- Toast Logic ---
  toast = {
    visible: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: '',
  };
  private toastTimer: any = null;

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { visible: true, type, title: title || (type === 'error' ? 'Error' : 'Éxito'), message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => this.closeToast(), 4000);
  }

  closeToast() {
    this.toast.visible = false;
    this.cdr.detectChanges();
  }

  openEmailModal() {
    this.isEmailModalOpen = true;
  }

  closeEmailModal() {
    this.isEmailModalOpen = false;
  }

  sendEmailReport() {
    if (!this.emailDestination || !this.emailDestination.includes('@')) {
      this.showToast('Por favor, ingresa un correo electrónico válido.', 'error', 'Correo Inválido');
      return;
    }

    this.isSendingEmail = true;
    this.dataService.sendReportEmail(this.emailDestination, this.emailPeriod).subscribe({
      next: (res) => {
        this.showToast(res.message || 'Reporte enviado con éxito.', 'success', 'Enviado');
        this.isSendingEmail = false;
        this.closeEmailModal();
      },
      error: (err) => {
        const errorMsg = err.error?.detail || err.message || 'Error desconocido';
        this.showToast('Error al enviar el correo: ' + errorMsg, 'error', 'Fallo al Enviar');
        this.isSendingEmail = false;
        this.cdr.detectChanges();
      }
    });
  }
}
