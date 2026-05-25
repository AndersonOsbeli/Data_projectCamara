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
  // Selected location for filter (empty = show top 3)
  selectedLocation: string = '';

  // Doughnut Chart Data
  public doughnutChartLabels: string[] = ['Hombres', 'Mujeres'];
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: this.doughnutChartLabels,
    datasets: [
      { data: [0, 0], backgroundColor: ['#5142f5', '#f542a4'], borderWidth: 0 }
    ]
  };
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#ffffff' } }
    }
  };

  // Bar Chart Data
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { color: '#2a2b36' }, ticks: { color: '#ffffff' } },
      y: { grid: { color: '#2a2b36' }, ticks: { color: '#ffffff' } }
    },
    plugins: {
      legend: { display: false }
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Detecciones', backgroundColor: '#29fd53', borderRadius: 5 }
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
        
        // Fuerza el redibujado de componentes estructurales de Angular v21
        this.cdr.detectChanges();
        this.charts?.forEach(chart => chart.update());
      },
      error: (err) => console.error('Error fetching registros para métricas:', err)
    });
  }

  updateChartTheme(isLight: boolean) {
    const textColor = isLight ? '#1f2937' : '#ffffff';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : '#2a2b36';

    if (this.doughnutChartOptions?.plugins?.legend?.labels) {
      this.doughnutChartOptions.plugins.legend.labels.color = textColor;
    }

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

    if (this.selectedLocation) {
      filtered = this.allLocationsData.filter(l => l.name === this.selectedLocation);
    } else {
      filtered = this.allLocationsData.slice(0, 3);
    }

    this.barChartData = {
      labels: filtered.map(l => l.name),
      datasets: [{
        data: filtered.map(l => l.count),
        label: 'Detecciones',
        backgroundColor: filtered.map((_, i) =>
          i === 0 ? '#29fd53' : i === 1 ? '#5142f5' : '#f542a4'
        ),
        borderRadius: 5
      }]
    };

    this.cdr.detectChanges();
    this.charts?.forEach(chart => chart.update());
  }

  clearFilter() {
    this.selectedLocation = '';
    this.applyFilter();
  }
}