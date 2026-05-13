import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Registro {
  id_registro: string;
  clase: string;
  genero: string;
  fecha: string;
  hora: string;
  lugar: string;
}

export interface DemographicsSummary {
  total: number;
  males: number;
  females: number;
  animals: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private http = inject(HttpClient);
  // Real API URL (FastAPI)
  private apiUrl = 'http://localhost:8000/api/registros';

  // Mock data as fallback
  private mockData: Registro[] = [
    { id_registro: 'ID-01', clase: 'persona', genero: 'Masculino', fecha: '2023-10-01', hora: '08:00', lugar: 'Entrada Principal' },
    { id_registro: 'ID-02', clase: 'persona', genero: 'Femenino', fecha: '2023-10-01', hora: '08:05', lugar: 'Entrada Principal' },
    { id_registro: 'ID-03', clase: 'persona', genero: 'Masculino', fecha: '2023-10-01', hora: '08:15', lugar: 'Pasillo A' },
    { id_registro: 'ID-04', clase: 'persona', genero: 'Femenino', fecha: '2023-10-01', hora: '09:00', lugar: 'Pasillo B' },
    { id_registro: 'ID-05', clase: 'animal', genero: 'N/A', fecha: '2023-10-01', hora: '09:30', lugar: 'Patio' },
    { id_registro: 'ID-06', clase: 'persona', genero: 'Femenino', fecha: '2023-10-02', hora: '07:45', lugar: 'Entrada Principal' },
    { id_registro: 'ID-07', clase: 'persona', genero: 'Masculino', fecha: '2023-10-02', hora: '08:20', lugar: 'Pasillo A' },
    { id_registro: 'ID-08', clase: 'persona', genero: 'Masculino', fecha: '2023-10-02', hora: '10:10', lugar: 'Entrada Principal' },
  ];

  getRegistros(): Observable<Registro[]> {
    // Try to call the real API, if it fails (e.g., 401 Unauthorized or CORS), return mock data
    return this.http.get<Registro[]>(this.apiUrl).pipe(
      catchError(err => {
        console.warn('Real API failed or returned error. Using mock data for dashboard visualization.', err);
        return of(this.mockData);
      })
    );
  }

  getSummary(): Observable<DemographicsSummary> {
    return this.getRegistros().pipe(
      map(registros => {
        return registros.reduce((acc, curr) => {
          acc.total++;
          if (curr.clase && curr.clase.toLowerCase() === 'persona') {
            const genero = (curr.genero || '').toLowerCase();
            if (genero === 'masculino' || genero === 'h') acc.males++;
            else if (genero === 'femenino' || genero === 'm') acc.females++;
          } else if (curr.clase && curr.clase.toLowerCase() === 'animal') {
            acc.animals++;
          }
          return acc;
        }, { total: 0, males: 0, females: 0, animals: 0 });
      })
    );
  }

  sendReportEmail(email: string, periodDays: number): Observable<any> {
    const url = 'http://localhost:8000/api/reports/email';
    return this.http.post(url, { email, period_days: periodDays });
  }
}
