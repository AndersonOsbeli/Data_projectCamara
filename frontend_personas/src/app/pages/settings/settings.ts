import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  // Apariencia y Temas
  lightTheme = false;
  
  // Tipografía y Texto
  fontFamily = 'Inter';
  fontSize = 'medium';

  ngOnInit() {
    // 1. Cargar preferencias del almacenamiento local al iniciar la pestaña
    this.lightTheme = localStorage.getItem('settings-light-theme') === 'true';
    this.fontFamily = localStorage.getItem('settings-font') || 'Inter';
    this.fontSize = localStorage.getItem('settings-font-size') || 'medium';

    // 2. Aplicar la configuración guardada de forma global
    this.applyThemeToDocument();
    this.applyFontToDocument();
    this.applyFontSizeToDocument();
  }

  // --- MÉTODOS DE APLICACIÓN REAL EN EL DOM (Efecto real sin tocar Backend) ---

  setTheme(isLight: boolean) {
    this.lightTheme = isLight;
    localStorage.setItem('settings-light-theme', String(isLight));
    this.applyThemeToDocument();
  }

  applyThemeToDocument() {
    if (this.lightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  changeFont(fontName: string) {
    this.fontFamily = fontName;
    localStorage.setItem('settings-font', fontName);
    this.applyFontToDocument();
  }

  applyFontToDocument() {
    // Cambia la variable CSS global --main-font para heredar la tipografía en todo el sistema
    document.documentElement.style.setProperty('--main-font', `'${this.fontFamily}', sans-serif`);
  }

  changeFontSize(size: string) {
    this.fontSize = size;
    localStorage.setItem('settings-font-size', size);
    this.applyFontSizeToDocument();
  }

  applyFontSizeToDocument() {
    // Escala la tipografía base de la app
    let pixelSize = '16px';
    if (this.fontSize === 'small') pixelSize = '14px';
    if (this.fontSize === 'large') pixelSize = '18px';
    
    document.documentElement.style.fontSize = pixelSize;
  }

  onResetSettings() {
    // Restaurar los valores por defecto locales
    this.setTheme(false);
    this.changeFont('Inter');
    this.changeFontSize('medium');
  }
}
