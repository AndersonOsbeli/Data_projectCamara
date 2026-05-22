import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const colorMap: Record<string, string> = {
  purple: '#7c3aed',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  black: '#1f2937'
};

const rgbMap: Record<string, string> = {
  purple: '124, 58, 237',
  blue: '59, 130, 246',
  green: '16, 185, 129',
  red: '239, 68, 68',
  black: '31, 41, 55'
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  // Navigation
  activeTab = 'apariencia';

  // Config variables
  lightTheme = false;
  primaryColor = 'purple';
  menuStyle = 'expanded';
  showIcons = true;
  showText = true;

  // Typography
  fontFamily = 'Inter';
  fontSize = 'medium';

  // Notifications
  soundEnabled = true;
  animationsEnabled = true;
  notificationsEnabled = true;

  // Accessibility
  highContrast = false;
  largeText = false;
  reduceMotion = false;
  readingMode = false;

  // UI States
  toastMessage = '';
  showToast = false;

  ngOnInit() {
    this.loadSettings();
    this.applyAllSettings();
  }

  loadSettings() {
    this.lightTheme = localStorage.getItem('settings-light-theme') === 'true';
    this.primaryColor = localStorage.getItem('settings-primary-color') || 'purple';
    this.menuStyle = localStorage.getItem('settings-menu-style') || 'expanded';
    this.showIcons = localStorage.getItem('settings-show-icons') !== 'false';
    this.showText = localStorage.getItem('settings-show-text') !== 'false';
    
    this.fontFamily = localStorage.getItem('settings-font') || 'Inter';
    this.fontSize = localStorage.getItem('settings-font-size') || 'medium';

    this.soundEnabled = localStorage.getItem('settings-sound') !== 'false';
    this.animationsEnabled = localStorage.getItem('settings-animations') !== 'false';
    this.notificationsEnabled = localStorage.getItem('settings-notifications') !== 'false';

    this.highContrast = localStorage.getItem('settings-contrast') === 'true';
    this.largeText = localStorage.getItem('settings-large-text') === 'true';
    this.reduceMotion = localStorage.getItem('settings-reduce-motion') === 'true';
    this.readingMode = localStorage.getItem('settings-reading-mode') === 'true';
  }

  saveSettings(showToast: boolean = true) {
    localStorage.setItem('settings-light-theme', String(this.lightTheme));
    localStorage.setItem('settings-primary-color', this.primaryColor);
    localStorage.setItem('settings-menu-style', this.menuStyle);
    localStorage.setItem('settings-show-icons', String(this.showIcons));
    localStorage.setItem('settings-show-text', String(this.showText));
    
    localStorage.setItem('settings-font', this.fontFamily);
    localStorage.setItem('settings-font-size', this.fontSize);

    localStorage.setItem('settings-sound', String(this.soundEnabled));
    localStorage.setItem('settings-animations', String(this.animationsEnabled));
    localStorage.setItem('settings-notifications', String(this.notificationsEnabled));

    localStorage.setItem('settings-contrast', String(this.highContrast));
    localStorage.setItem('settings-large-text', String(this.largeText));
    localStorage.setItem('settings-reduce-motion', String(this.reduceMotion));
    localStorage.setItem('settings-reading-mode', String(this.readingMode));

    this.applyAllSettings();
    if (showToast) {
      this.triggerToast('¡Configuración guardada exitosamente!');
    }
  }

  applyAllSettings() {
    this.applyThemeToDocument();
    this.applyAccentColorToDocument();
    this.applyMenuToDocument();
    this.applyFontToDocument();
    this.applyFontSizeToDocument();
    this.applyAccessibilityToDocument();
  }

  // --- ACTIONS ---

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  setTheme(isLight: boolean) {
    this.lightTheme = isLight;
    this.saveSettings(false);
  }

  applyThemeToDocument() {
    if (this.lightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  setPrimaryColor(color: string) {
    this.primaryColor = color;
    this.saveSettings(false);
  }

  applyAccentColorToDocument() {
    const hex = colorMap[this.primaryColor] || '#7c3aed';
    const rgb = rgbMap[this.primaryColor] || '124, 58, 237';
    document.documentElement.style.setProperty('--accent-color', hex);
    document.documentElement.style.setProperty('--accent-color-rgb', rgb);
  }

  setMenuStyle(style: string) {
    this.menuStyle = style;
    if (style === 'icons') {
      this.showText = false;
      this.showIcons = true;
    } else {
      this.showText = true;
      this.showIcons = true;
    }
    this.saveSettings(false);
  }

  applyMenuSettings() {
    this.saveSettings(false);
  }

  applyMenuToDocument() {
    document.body.classList.remove('sidebar-expanded', 'sidebar-compact', 'sidebar-icons');
    if (this.menuStyle === 'expanded') {
      document.body.classList.add('sidebar-expanded');
    } else if (this.menuStyle === 'compact') {
      document.body.classList.add('sidebar-compact');
    } else if (this.menuStyle === 'icons') {
      document.body.classList.add('sidebar-icons');
    }

    if (!this.showIcons) {
      document.body.classList.add('sidebar-no-icons');
    } else {
      document.body.classList.remove('sidebar-no-icons');
    }

    if (!this.showText) {
      document.body.classList.add('sidebar-no-text');
    } else {
      document.body.classList.remove('sidebar-no-text');
    }
  }

  changeFont(fontName: string) {
    this.fontFamily = fontName;
    this.saveSettings(false);
  }

  applyFontToDocument() {
    document.documentElement.style.setProperty('--main-font', `'${this.fontFamily}', sans-serif`);
  }

  changeFontSize(size: string) {
    this.fontSize = size;
    this.saveSettings(false);
  }

  applyFontSizeToDocument() {
    let pixelSize = '16px';
    if (this.fontSize === 'small') pixelSize = '14px';
    if (this.fontSize === 'large') pixelSize = '18px';
    document.documentElement.style.fontSize = pixelSize;
  }

  toggleAccessibility(option: string) {
    if (option === 'contrast') this.highContrast = !this.highContrast;
    if (option === 'largeText') this.largeText = !this.largeText;
    if (option === 'reduceMotion') this.reduceMotion = !this.reduceMotion;
    if (option === 'readingMode') this.readingMode = !this.readingMode;
    this.saveSettings(false);
  }

  applyAccessibilityToDocument() {
    const body = document.body;
    
    if (this.highContrast) body.classList.add('high-contrast');
    else body.classList.remove('high-contrast');

    if (this.largeText) body.classList.add('large-text');
    else body.classList.remove('large-text');

    if (this.reduceMotion) body.classList.add('reduce-motion');
    else body.classList.remove('reduce-motion');

    if (this.readingMode) body.classList.add('reading-mode');
    else body.classList.remove('reading-mode');
  }

  applyPreset(preset: string) {
    if (preset === 'neon-dark') {
      this.lightTheme = false;
      this.primaryColor = 'purple';
      this.menuStyle = 'expanded';
      this.showIcons = true;
      this.showText = true;
    } else if (preset === 'clean-light') {
      this.lightTheme = true;
      this.primaryColor = 'blue';
      this.menuStyle = 'expanded';
      this.showIcons = true;
      this.showText = true;
    } else if (preset === 'corporate-blue') {
      this.lightTheme = false;
      this.primaryColor = 'blue';
      this.menuStyle = 'compact';
      this.showIcons = true;
      this.showText = true;
    } else if (preset === 'minimal-black') {
      this.lightTheme = false;
      this.primaryColor = 'black';
      this.menuStyle = 'icons';
      this.showIcons = true;
      this.showText = false;
    } else if (preset === 'forest-green') {
      this.lightTheme = false;
      this.primaryColor = 'green';
      this.menuStyle = 'expanded';
      this.showIcons = true;
      this.showText = true;
    }
    this.saveSettings(false);
    this.triggerToast(`Preset '${preset.replace('-', ' ')}' aplicado y guardado.`);
  }

  isPresetActive(preset: string): boolean {
    if (preset === 'neon-dark') {
      return !this.lightTheme && this.primaryColor === 'purple' && this.menuStyle === 'expanded' && this.showIcons && this.showText;
    }
    if (preset === 'clean-light') {
      return this.lightTheme && this.primaryColor === 'blue' && this.menuStyle === 'expanded' && this.showIcons && this.showText;
    }
    if (preset === 'corporate-blue') {
      return !this.lightTheme && this.primaryColor === 'blue' && this.menuStyle === 'compact' && this.showIcons && this.showText;
    }
    if (preset === 'minimal-black') {
      return !this.lightTheme && this.primaryColor === 'black' && this.menuStyle === 'icons';
    }
    if (preset === 'forest-green') {
      return !this.lightTheme && this.primaryColor === 'green' && this.menuStyle === 'expanded' && this.showIcons && this.showText;
    }
    return false;
  }

  getFontDesc(): string {
    if (this.fontFamily === 'Poppins') {
      return 'Poppins es una fuente moderna y legible, ideal para interfaces amigables y actuales.';
    } else if (this.fontFamily === 'Outfit') {
      return 'Outfit es una fuente premium, geométrica y extremadamente limpia, perfecta para cuadros de mando de alta tecnología.';
    }
    return 'Inter es una fuente técnica y neutra, diseñada específicamente para pantallas de ordenador y legibilidad perfecta.';
  }

  onSaveSettings() {
    this.saveSettings();
  }

  onResetSettings() {
    this.lightTheme = false;
    this.primaryColor = 'purple';
    this.menuStyle = 'expanded';
    this.showIcons = true;
    this.showText = true;
    
    this.fontFamily = 'Inter';
    this.fontSize = 'medium';

    this.soundEnabled = true;
    this.animationsEnabled = true;
    this.notificationsEnabled = true;

    this.highContrast = false;
    this.largeText = false;
    this.reduceMotion = false;
    this.readingMode = false;

    this.saveSettings(false);
    this.triggerToast('Configuración restaurada a valores por defecto.');
  }

  triggerToast(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3500);
  }
}
