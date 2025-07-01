import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, filter } from 'rxjs';

import { HeaderComponent } from './components/header/header';
import { VideoPlayerComponent } from './components/video-player/video-player';
import { SidePanelComponent } from './components/side-panel/side-panel';

import { M3uParserService } from './services/m3u-parser';
import { FavoritesService } from './services/favorites';
import { ThemeService } from './services/theme';

import { Channel, Movie, Series, M3UPlaylist } from './models/interfaces';

interface LoadStatus {
  type: 'success' | 'error' | 'warning';
  icon: string;
  message: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    HeaderComponent,
    VideoPlayerComponent,
    SidePanelComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'WebPlayer';
  
  // Estado da aplicação
  currentPlaylist: M3UPlaylist | null = null;
  selectedItem: Channel | Movie | Series | null = null;
  selectedItemType: 'channel' | 'movie' | 'series' | null = null;
  showInfoPanel = false;
  loading = false;
  loadStatus: LoadStatus | null = null;
  
  // Controles de interface
  m3uUrl = '';
  searchTerm = '';
  currentView: 'channels' | 'movies' | 'series' | 'favorites' = 'channels';
  
  private destroy$ = new Subject<void>();

  constructor(
    private m3uParser: M3uParserService,
    private favoritesService: FavoritesService,
    public themeService: ThemeService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Carregar URL M3U salva
    this.loadSavedM3UUrl();
    
    // Escutar mudanças de rota para atualizar currentView
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (url.includes('/channels')) {
        this.currentView = 'channels';
      } else if (url.includes('/movies')) {
        this.currentView = 'movies';
      } else if (url.includes('/series')) {
        this.currentView = 'series';
      } else if (url.includes('/favorites')) {
        this.currentView = 'favorites';
      }
    });

    // Escutar mudanças nos favoritos
    this.favoritesService.favorites$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateFavoriteStatus();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadM3U(): void {
    if (!this.m3uUrl.trim()) {
      this.showSnackBar('Por favor, insira uma URL válida', 'error');
      return;
    }

    this.loading = true;
    this.loadStatus = null;

    this.m3uParser.parseM3UFromUrl(this.m3uUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlist) => {
          this.handlePlaylistLoaded(playlist);
        },
        error: (error) => {
          this.handleLoadError(error);
        }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
      this.showSnackBar('Por favor, selecione um arquivo .m3u ou .m3u8', 'error');
      return;
    }

    this.loading = true;
    this.loadStatus = null;

    this.m3uParser.parseM3UFromFile(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlist) => {
          this.handlePlaylistLoaded(playlist);
          this.m3uUrl = file.name; // Mostrar nome do arquivo
        },
        error: (error) => {
          this.handleLoadError(error);
        }
      });

    // Limpar input
    input.value = '';
  }

  private handlePlaylistLoaded(playlist: M3UPlaylist): void {
    this.currentPlaylist = playlist;
    this.loading = false;
    
    const totalItems = playlist.channels.length + playlist.movies.length + playlist.series.length;
    
    this.showSnackBar(
      `Lista carregada com sucesso! ${totalItems} itens encontrados.`,
      'success'
    );
    
    // Salvar URL para próxima sessão (apenas se for URL)
    if (this.m3uUrl.startsWith('http')) {
      this.saveM3UUrl();
    }
    
    // Atualizar status de favoritos
    this.updateFavoriteStatus();
    
    // Navegar para a seção apropriada
    this.navigateToFirstAvailableSection(playlist);
  }

  private handleLoadError(error: any): void {
    this.loading = false;
    console.error('Erro ao carregar M3U:', error);
    
    const errorMessage = error.message || 'Erro ao carregar a lista. Verifique a URL/arquivo e tente novamente.';
    this.showSnackBar(errorMessage, 'error');
  }

  private navigateToFirstAvailableSection(playlist: M3UPlaylist): void {
    if (playlist.channels.length > 0) {
      this.router.navigate(['/channels']);
    } else if (playlist.movies.length > 0) {
      this.router.navigate(['/movies']);
    } else if (playlist.series.length > 0) {
      this.router.navigate(['/series']);
    }
  }

  selectItem(item: Channel | Movie | Series, type: 'channel' | 'movie' | 'series'): void {
    this.selectedItem = item;
    this.selectedItemType = type;
    this.showInfoPanel = true;
  }

  closeInfoPanel(): void {
    this.showInfoPanel = false;
  }

  private showSnackBar(message: string, type: 'success' | 'error' | 'warning'): void {
    const config = {
      duration: type === 'error' ? 6000 : 4000,
      panelClass: [`snackbar-${type}`]
    };

    this.snackBar.open(message, 'Fechar', config);
  }

  private updateFavoriteStatus(): void {
    if (!this.currentPlaylist) return;

    // Atualizar status de favoritos nos canais
    this.currentPlaylist.channels.forEach(channel => {
      channel.isFavorite = this.favoritesService.isFavorite(channel.id, 'channel');
    });

    // Atualizar status de favoritos nos filmes
    this.currentPlaylist.movies.forEach(movie => {
      movie.isFavorite = this.favoritesService.isFavorite(movie.id, 'movie');
    });

    // Atualizar status de favoritos nas séries
    this.currentPlaylist.series.forEach(series => {
      series.isFavorite = this.favoritesService.isFavorite(series.id, 'series');
    });
  }

  private saveM3UUrl(): void {
    try {
      localStorage.setItem('webplayer_m3u_url', this.m3uUrl);
    } catch (error) {
      console.warn('Erro ao salvar URL M3U:', error);
    }
  }

  private loadSavedM3UUrl(): void {
    try {
      const savedUrl = localStorage.getItem('webplayer_m3u_url');
      if (savedUrl) {
        this.m3uUrl = savedUrl;
      }
    } catch (error) {
      console.warn('Erro ao carregar URL M3U salva:', error);
    }
  }

  // Getter para acessar dados da playlist nos templates filhos
  get playlistData(): M3UPlaylist | null {
    return this.currentPlaylist;
  }

  getSelectedItemTitle(): string {
    if (!this.selectedItem) return '';
    return 'name' in this.selectedItem ? this.selectedItem.name : this.selectedItem.title;
  }

  // Métodos para contadores na sidebar
  getChannelsCount(): number {
    return this.currentPlaylist?.channels.length || 0;
  }

  getMoviesCount(): number {
    return this.currentPlaylist?.movies.length || 0;
  }

  getSeriesCount(): number {
    return this.currentPlaylist?.series.length || 0;
  }

  getFavoritesCount(): number {
    return this.favoritesService.getFavoritesCount();
  }
}

