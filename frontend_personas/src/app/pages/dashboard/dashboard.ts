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
    const isLightTheme = localStorage.getItem('settings-light-theme') === 'true';
    this.updateChartTheme(isLightTheme);

    this.dataService.getSummary().subscribe({
      next: (sum) => {
        this.summary = sum;
        this.doughnutChartData = {
          labels: this.doughnutChartLabels,
          datasets: [{
            data: [sum.males, sum.females],
            backgroundColor: ['#5142f5', '#f542a4'],
            borderWidth: 0
          }]
        };
        this.cdr.detectChanges();
        this.charts?.forEach(chart => chart.update());
      },
      error: (err) => console.error('Error fetching summary:', err)
    });

    this.dataService.getRegistros().subscribe({
      next: (registros) => {
        // Count all locations
        const locationsCount: { [key: string]: number } = {};
        registros.forEach(r => {
          const loc = (r.lugar || 'Desconocido').trim();
          locationsCount[loc] = (locationsCount[loc] || 0) + 1;
        });

        // Sort by count descending
        this.allLocationsData = Object.entries(locationsCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Show top 3 by default
        this.applyFilter();
      },
      error: (err) => console.error('Error fetching registros:', err)
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
      // Show only the selected location
      filtered = this.allLocationsData.filter(l => l.name === this.selectedLocation);
    } else {
      // Show top 3
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

