import { Component, inject, OnInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { DataService, DemographicsSummary } from '../../services/data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private dataService = inject(DataService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

  summary: DemographicsSummary = { total: 0, males: 0, females: 0, animals: 0 };

  // All locations data (sorted by count desc)
  allLocationsData: { name: string; count: number }[] = [];
  // Selected locations for filter (empty = show top 3)
  selectedLocations: string[] = [];
  locationToAdd: string = '';

  // Actividad Reciente
  recentActivity: any[] = [];

  // Doughnut Chart Data
  public doughnutChartLabels: string[] = ['Hombres', 'Mujeres'];
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: this.doughnutChartLabels,
    datasets: [
      { 
        data: [0, 0], 
        backgroundColor: ['#5142f5', '#f542a4'], 
        borderWidth: 0,
        hoverOffset: 4
      }
    ]
  };
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" }
      }
    }
  };

  // Bar Chart Data (Actividad)
  public barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { 
        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
        ticks: { color: '#9ca3af', font: { family: "'Inter', sans-serif" } } 
      },
      y: { 
        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
        ticks: { color: '#9ca3af', font: { family: "'Inter', sans-serif" } },
        beginAtZero: true
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" }
      }
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { 
        data: [], 
        label: 'Detecciones', 
        backgroundColor: ['#00e676', '#5142f5', '#f542a4'],
        borderRadius: 6
      }
    ]
  };

  ngOnInit() {
    const isLightTheme = document.body.classList.contains('light-theme');
    this.updateChartTheme(isLightTheme);

    // 🚀 OPTIMIZACIÓN FULL-STACK: Centralizamos el cálculo sobre getRegistros() para blindar el Dashboard contra retrasos del servicio summary
    this.dataService.getRegistros().subscribe({
      next: (registros: any[]) => {
        if (!registros || registros.length === 0) {
          console.warn('[DASHBOARD]: No se encontraron filas de tránsito en el archivo del backend.');
          return;
        }

        console.log('[DASHBOARD]: Sincronizando en caliente un total de:', registros.length, 'registros.');

        // 1. Calculamos las métricas analíticas principales basándonos en tu Excel relacional
        const total = registros.length;
        
        // Mapeo flexible para strings guardados por OpenCV (.toLowerCase() previene fallos por mayúsculas)
        const males = registros.filter(r => 
          r.genero && (r.genero.toLowerCase() === 'hombre' || r.genero.toLowerCase() === 'masculino' || r.genero.toLowerCase() === 'm')
        ).length;

        const females = registros.filter(r => 
          r.genero && (r.genero.toLowerCase() === 'mujer' || r.genero.toLowerCase() === 'femenino' || r.genero.toLowerCase() === 'f')
        ).length;

        // Sincronizamos el objeto summary que leen tus tres tarjetas del HTML
        this.summary = {
          total: total,
          males: males,
          females: females,
          animals: 0
        };

        // 2. Forzamos la actualización inmediata del gráfico de pastel (Doughnut)
        this.doughnutChartData = {
          labels: this.doughnutChartLabels,
          datasets: [{
            data: [males, females],
            backgroundColor: ['#5142f5', '#f542a4'],
            borderWidth: 0
          }]
        };

        // 3. Procesamos los datos geográficos para el gráfico de barras (Locations)
        const locationsCount: { [key: string]: number } = {};
        registros.forEach(r => {
          const loc = (r.lugar || 'Desconocido').trim();
          locationsCount[loc] = (locationsCount[loc] || 0) + 1;
        });

        // Ordenamos ubicaciones de mayor a menor
        this.allLocationsData = Object.entries(locationsCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Pintamos el Top 3 de ubicaciones en las barras
        this.applyFilter();
        // 4. Actividad Reciente en Vivo
        this.recentActivity = [...registros].reverse().slice(0, 5).map(r => {
          const isFemale = r.genero && (r.genero.toLowerCase() === 'mujer' || r.genero.toLowerCase() === 'femenino' || r.genero.toLowerCase() === 'f');
          const timeOnly = r.fecha ? r.fecha.split(' ')[1] || r.fecha : 'Ahora';
          return {
            genero: isFemale ? 'Mujer' : 'Hombre',
            lugar: r.lugar || 'Desconocido',
            fecha: timeOnly
          };
        });
        
        // Fuerza el redibujado de componentes estructurales de Angular v21
        this.cdr.detectChanges();
        this.charts?.forEach(chart => chart.update());
      },
      error: (err) => console.error('Error fetching registros para métricas:', err)
    });
  }

  updateChartTheme(isLight: boolean) {
    const textColor = isLight ? '#1f2937' : '#9ca3af';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

    if (this.barChartOptions?.scales) {
      if (this.barChartOptions.scales['x']) {
        this.barChartOptions.scales['x'].grid = { color: gridColor };
        this.barChartOptions.scales['x'].ticks = { color: textColor };
      }
      if (this.barChartOptions.scales['y']) {
        this.barChartOptions.scales['y'].grid = { color: gridColor };
        this.barChartOptions.scales['y'].ticks = { color: textColor };
      }
    }
  }

  applyFilter() {
    let filtered: { name: string; count: number }[];

    if (this.selectedLocations.length > 0) {
      filtered = this.allLocationsData.filter(l => this.selectedLocations.includes(l.name));
    } else {
      filtered = this.allLocationsData.slice(0, 3);
    }

    this.barChartData = {
      labels: filtered.map(l => l.name),
      datasets: [{
        data: filtered.map(l => l.count),
        label: 'Detecciones',
        backgroundColor: filtered.map((_, i) =>
          i === 0 ? '#00e676' : i === 1 ? '#5142f5' : '#f542a4'
        ),
        borderRadius: 6
      }]
    };

    this.cdr.detectChanges();
    this.charts?.forEach(chart => chart.update());
  }

  addLocation(name: string) {
    if (!name) return;
    if (this.selectedLocations.length >= 3) {
      this.locationToAdd = '';
      return;
    }
    if (!this.selectedLocations.includes(name)) {
      this.selectedLocations.push(name);
      this.applyFilter();
    }
    setTimeout(() => this.locationToAdd = '', 0);
  }

  removeLocation(name: string) {
    this.selectedLocations = this.selectedLocations.filter(l => l !== name);
    this.applyFilter();
  }

  clearFilter() {
    this.selectedLocations = [];
    this.applyFilter();
  }
}