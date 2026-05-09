import { Component, inject, OnInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { DataService, Registro } from '../../services/data.service';

@Component({
  selector: 'app-demographics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './demographics.html',
  styleUrl: './demographics.scss'
})
export class Demographics implements OnInit {
  private dataService = inject(DataService);
  private cdr = inject(ChangeDetectorRef);
  
  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

  // Insights
  busiestHour = 'N/A';
  mostWomenLocation = 'N/A';
  mostMenLocation = 'N/A';

  // Line Chart (Horas Pico)
  public lineChartType: ChartType = 'line';
  public lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.4 } // curvy line
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#fff' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#fff' } }
    },
    plugins: { legend: { labels: { color: '#fff' } } }
  };

  // Stacked Bar Chart (Género por ubicación)
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#fff' } },
      y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#fff' } }
    },
    plugins: { legend: { labels: { color: '#fff' } } }
  };

  ngOnInit() {
    this.dataService.getRegistros().subscribe({
      next: (registros) => {
        // Filter out animals, keep only "persona"
        const personas = registros.filter(r => r.clase && r.clase.toLowerCase() === 'persona');

        this.processTimeData(personas);
        this.processLocationGenderData(personas);
        this.cdr.detectChanges();
        this.charts?.forEach(c => c.update());
      },
      error: (err) => console.error("Error fetching data:", err)
    });
  }

  processTimeData(personas: Registro[]) {
    const hourCounts: { [hour: string]: number } = {};
    personas.forEach(p => {
      if (p.hora) {
        // Extract hour "HH"
        const hour = p.hora.substring(0, 2) + ':00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // Sort hours
    const sortedHours = Object.keys(hourCounts).sort();
    const data = sortedHours.map(h => hourCounts[h]);

    if (sortedHours.length > 0) {
      // Find busiest hour
      let maxCount = -1;
      let maxHour = '';
      sortedHours.forEach(h => {
        if (hourCounts[h] > maxCount) {
          maxCount = hourCounts[h];
          maxHour = h;
        }
      });
      this.busiestHour = maxHour;
    }

    this.lineChartData = {
      labels: sortedHours,
      datasets: [
        {
          data: data,
          label: 'Tráfico (Personas)',
          backgroundColor: 'rgba(253, 152, 41, 0.2)', // Orange area
          borderColor: '#fd9829',
          pointBackgroundColor: '#fff',
          pointBorderColor: '#fd9829',
          fill: true
        }
      ]
    };
  }

  processLocationGenderData(personas: Registro[]) {
    const locGenderData: { [loc: string]: { males: number, females: number } } = {};
    
    personas.forEach(p => {
      const loc = (p.lugar || 'Desconocido').trim();
      const gen = (p.genero || '').toLowerCase();
      
      if (!locGenderData[loc]) locGenderData[loc] = { males: 0, females: 0 };
      
      if (gen === 'masculino' || gen === 'h') locGenderData[loc].males++;
      else if (gen === 'femenino' || gen === 'm') locGenderData[loc].females++;
    });

    const locations = Object.keys(locGenderData);
    const maleCounts = locations.map(l => locGenderData[l].males);
    const femaleCounts = locations.map(l => locGenderData[l].females);

    // Calculate insights
    let maxFemales = -1;
    let mostFemalesLoc = 'N/A';
    let maxMales = -1;
    let mostMalesLoc = 'N/A';

    locations.forEach(l => {
      if (locGenderData[l].females > maxFemales) {
        maxFemales = locGenderData[l].females;
        mostFemalesLoc = l;
      }
      if (locGenderData[l].males > maxMales) {
        maxMales = locGenderData[l].males;
        mostMalesLoc = l;
      }
    });

    this.mostWomenLocation = mostFemalesLoc || 'N/A';
    this.mostMenLocation = mostMalesLoc || 'N/A';

    this.barChartData = {
      labels: locations,
      datasets: [
        {
          data: maleCounts,
          label: 'Hombres',
          backgroundColor: '#5142f5',
          borderRadius: 4
        },
        {
          data: femaleCounts,
          label: 'Mujeres',
          backgroundColor: '#f542a4',
          borderRadius: 4
        }
      ]
    };
  }
}
