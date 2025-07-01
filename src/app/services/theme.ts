import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Theme } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'webplayer-theme';
  private readonly DARK_THEME_CLASS = 'dark-theme';
  
  private currentThemeSubject = new BehaviorSubject<Theme>({
    name: 'light',
    isDark: false
  });
  
  public currentTheme$ = this.currentThemeSubject.asObservable();
  public isDarkMode$ = this.currentTheme$.pipe(
    map(theme => theme.isDark)
  );

  constructor() {
    this.loadTheme();
  }

  private loadTheme(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const theme = JSON.parse(stored);
        this.setTheme(theme.isDark);
      } else {
        // Detectar preferência do sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark);
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
      this.setTheme(false); // Fallback para tema claro
    }
  }

  private saveTheme(theme: Theme): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(theme));
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
  }

  setTheme(isDark: boolean): void {
    const theme: Theme = {
      name: isDark ? 'dark' : 'light',
      isDark: isDark
    };

    // Aplicar classe CSS ao body
    if (isDark) {
      document.body.classList.add(this.DARK_THEME_CLASS);
    } else {
      document.body.classList.remove(this.DARK_THEME_CLASS);
    }

    // Atualizar meta theme-color para mobile
    this.updateThemeColor(isDark);

    this.currentThemeSubject.next(theme);
    this.saveTheme(theme);
  }

  toggleTheme(): void {
    const currentTheme = this.currentThemeSubject.value;
    this.setTheme(!currentTheme.isDark);
  }

  getCurrentTheme(): Theme {
    return this.currentThemeSubject.value;
  }

  isDarkMode(): boolean {
    return this.currentThemeSubject.value.isDark;
  }

  private updateThemeColor(isDark: boolean): void {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const color = isDark ? '#121212' : '#ffffff';
    
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }

  // Escutar mudanças na preferência do sistema
  watchSystemTheme(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
      // Só aplicar se o usuário não tiver uma preferência salva
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        this.setTheme(e.matches);
      }
    });
  }

  // Obter cores do tema atual
  getThemeColors(): { primary: string; background: string; surface: string; text: string } {
    const isDark = this.isDarkMode();
    
    if (isDark) {
      return {
        primary: '#bb86fc',
        background: '#121212',
        surface: '#1e1e1e',
        text: '#ffffff'
      };
    } else {
      return {
        primary: '#6200ea',
        background: '#ffffff',
        surface: '#f5f5f5',
        text: '#000000'
      };
    }
  }
}

