import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { FormBuilder, FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, filter, debounceTime, BehaviorSubject } from 'rxjs';

import { HeaderComponent } from './components/header/header';
import { VideoPlayerComponent } from './components/video-player/video-player';
import { SidePanelComponent } from './components/side-panel/side-panel';

import { M3uParserService } from './services/m3u-parser';
import { FavoritesService } from './services/favorites';
import { ThemeService } from './services/theme';

import { Channel, Movie, Series, M3UPlaylist } from './models/interfaces';
import { Functions } from '../functions';
import { environment } from '../environments/environment';
import { AuthService } from './auth/auth.service';

interface LoadStatus {
    type: 'success' | 'error' | 'warning';
    icon: string;
    message: string;
}

interface GroupedItems<T> {
    key: string;
    value: T[];
}

interface ProcessingProgress {
    current: number;
    total: number;
    percentage: number;
    stage: 'loading' | 'processing' | 'grouping' | 'complete';
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
    styleUrls: ['./app.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'GZ WebPlayer';
    apiUrl = environment.API_URL;

    // Estado da aplicação
    currentPlaylist: M3UPlaylist | null = null;
    selectedItem: Channel | Movie | Series | null = null;
    selectedItemType: 'channel' | 'movie' | 'series' | null = null;
    showInfoPanel = false;
    loading = false;
    loadStatus: LoadStatus | null = null;
    
    // Dados agrupados com carregamento lazy
    groupedChannels: Record<string, Channel[]> = {};
    groupedMovies: Record<string, Movie[]> = {};
    groupedSeries: Record<string, Series[]> = {};

    // Arrays ordenados para exibição
    sortedChannelGroups: GroupedItems<Channel>[] = [];
    sortedMovieGenres: GroupedItems<Movie>[] = [];
    sortedSeriesGroups: GroupedItems<Series>[] = [];

    // Controles de interface
    m3uUrl = '';
    searchTerm = '';
    showChannels: boolean = false;
    showMovies: boolean = false;
    showSeries: boolean = false;
    currentView: 'channels' | 'movies' | 'series' | 'favorites' = 'channels';

    // Controle de performance e progresso
    private isInitialLoad = true;
    private readonly BATCH_SIZE = 100;
    private readonly PROCESSING_DELAY = 16; // ~60fps
    private readonly IMAGE_PRELOAD_COUNT = 10;
    
    // Cache para otimizações
    private _cachedCounts: {
        channels?: number;
        movies?: number;
        series?: number;
        favorites?: number;
    } = {};

    // Progresso de processamento
    processingProgress$ = new BehaviorSubject<ProcessingProgress>({
        current: 0,
        total: 0,
        percentage: 0,
        stage: 'loading'
    });

    isLogedIn = false;
    private destroy$ = new Subject<void>();
    private processingAbortController?: AbortController;

    constructor(
        private m3uParser: M3uParserService,
        private favoritesService: FavoritesService,
        public themeService: ThemeService,
        private router: Router,
        private snackBar: MatSnackBar,
        public functions: Functions,
        private authService: AuthService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef
    ) {
        this.authService.isLoggedIn$.subscribe(isLoggedIn => {
            this.isLogedIn = isLoggedIn;
            this.cdr.markForCheck();
        });

        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(event => {
                const nav = event as NavigationEnd;
                if (nav.urlAfterRedirects !== '/login') {
                    this.loadM3U({});
                }
            });
    }

    ngOnInit(): void {
        this.setupRouteListener();
        this.setupFavoritesListener();
        this.loadSavedM3UUrl();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.abortProcessing();
    }

    /**
     * Configurar listener de rotas
     */
    private setupRouteListener(): void {
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
            
            this.cdr.markForCheck();
        });
    }

    /**
     * Configurar listener de favoritos com debounce
     */
    private setupFavoritesListener(): void {
        this.favoritesService.favorites$.pipe(
            debounceTime(200),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.updateFavoriteStatusOptimized();
            this.invalidateCache('favorites');
        });
    }

    /**
     * Carregamento principal otimizado com processamento assíncrono
     */
    async loadM3U(filter: { search?: string; field?: string; type?: 'channel' | 'movie' | 'series'}): Promise<void> {
        if (this.router.url === '/auth/login') {
            return;
        }

        // Abortar processamento anterior se existir
        this.abortProcessing();
        this.processingAbortController = new AbortController();

        this.loading = true;
        this.loadStatus = null;
        this.resetProgress();
        this.cdr.markForCheck();

        try {
            const startTime = performance.now();

            // Preparar formulário
            const form = this.fb.group({
                search: filter.search || '',
                field: filter.field || '',
                type: filter.type || ''
            });

            this.updateProgress(0, 100, 'loading');

            // Fazer requisição
            const result = await this.functions.formPostExpress(form.value, 'api/list');

            if (result?.success) {
                const items = result.data as any[];
console.log(items);
                if (this.processingAbortController?.signal.aborted) {
                    return;
                }

                this.updateProgress(20, 100, 'processing');

                // Processamento assíncrono em lotes
                await this.processPlaylistDataOptimized(items);

                if (this.processingAbortController?.signal.aborted) {
                    return;
                }

                this.updateProgress(80, 100, 'grouping');

                // Agrupar dados
                await this.groupAllItemsOptimized();
                this.updateProgress(100, 100, 'complete');
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);

                this.loadStatus = { 
                    type: 'success', 
                    icon: 'done', 
                    message: `${items.length} itens carregados em ${duration}ms` 
                };

                // Invalidar todos os caches
                this.invalidateAllCaches();
            } else {
                this.loadStatus = { 
                    type: 'error', 
                    icon: 'error', 
                    message: 'Erro ao carregar playlist' 
                };
            }
        } catch (error) {
            console.error('Erro ao carregar M3U:', error);

            this.loadStatus = { 
                type: 'error', 
                icon: 'error', 
                message: 'Erro ao carregar playlist' 
            };

            this.snackBar.open('Erro ao carregar playlist', 'OK', { duration: 5000 });
        } finally {
            this.loading = false;
            this.cdr.markForCheck();
        }
    }

    /**
     * Processamento otimizado em lotes com controle de abort
     */
    private async processPlaylistDataOptimized(items: any[]): Promise<void> {
        const channels: Channel[] = [];
        const movies: Movie[] = [];
        const series: Series[] = [];

        let processed = 0;
        const total = items.length;

        // Processar em lotes para não bloquear a UI
        for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
            // Verificar se foi abortado
            if (this.processingAbortController?.signal.aborted) {
                throw new Error('Processing aborted');
            }

            const batch = items.slice(i, i + this.BATCH_SIZE);
            
            // Processar lote
            batch.forEach(item => {
                // Otimização: classificar sem criar objetos intermediários
                switch (item.item_type) {
                    case 'channel':
                        channels.push(item);
                        break;
                    case 'movie':
                        movies.push(item);
                        break;
                    case 'series':
                        series.push(item);
                        break;
                }

                processed++;
            });

            // Atualizar progresso
            const progressPercentage = 20 + Math.round((processed / total) * 60);
            this.updateProgress(processed, total, 'processing', progressPercentage);

            // Yield para a UI respirar
            await this.yieldToUI();
        }

        // Atualizar playlist de uma vez
        this.currentPlaylist = { channels, movies, series };
    }

    /**
     * Agrupamento otimizado e assíncrono
     */
    private async groupAllItemsOptimized(): Promise<void> {
        if (!this.currentPlaylist) return;

        // Agrupar canais
        await this.yieldToUI();
        this.groupedChannels = this.groupBySubType(this.currentPlaylist.channels);
        this.sortedChannelGroups = this.sortGroupedItems(this.groupedChannels);

        // Agrupar filmes  
        await this.yieldToUI();
        this.groupedMovies = this.groupBySubType(this.currentPlaylist.movies);
        this.sortedMovieGenres = this.sortGroupedItems(this.groupedMovies);

        // Agrupar séries
        await this.yieldToUI();
        this.groupedSeries = this.groupSeriesByName(this.currentPlaylist.series);
        this.sortedSeriesGroups = this.sortGroupedItems(this.groupedSeries);

        this.cdr.markForCheck();
    }

    /**
     * Agrupamento genérico otimizado por sub_type
     */
    private groupBySubType<T extends { item_subtype?: string }>(items: T[]): Record<string, T[]> {
        const groups: Record<string, T[]> = {};
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const subType = (item.item_subtype || 'Outros').trim();
            
            if (!groups[subType]) {
                groups[subType] = [];
            }
            groups[subType].push(item);
        }
        
        return groups;
    }

    /**
     * Agrupamento de séries por nome otimizado
     */
    private groupSeriesByName(series: Series[]): Record<string, Series[]> {
        const groups: Record<string, Series[]> = {};
        
        for (let i = 0; i < series.length; i++) {
            const serie = series[i];
            const seriesName = (serie.title || 'Série Desconhecida').trim();
            
            if (!groups[seriesName]) {
                groups[seriesName] = [];
            }
            groups[seriesName].push(serie);
        }
        
        return groups;
    }

    /**
     * Ordenação otimizada de itens agrupados
     */
    private sortGroupedItems<T>(groupedItems: Record<string, T[]>): GroupedItems<T>[] {
        return Object.entries(groupedItems)
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => {
                const countDiff = b.value.length - a.value.length;
                return countDiff !== 0 ? countDiff : a.key.localeCompare(b.key);
            });
    }

    /**
     * Atualização otimizada de status de favoritos
     */
    private updateFavoriteStatusOptimized(): void {
        if (!this.currentPlaylist) return;

        // Usar requestAnimationFrame para não bloquear UI
        requestAnimationFrame(() => {
            // Processar em lotes pequenos
            this.updateFavoritesBatch(this.currentPlaylist!.channels, 'channel');
            this.updateFavoritesBatch(this.currentPlaylist!.movies, 'movie');
            this.updateFavoritesBatch(this.currentPlaylist!.series, 'series');
            
            this.cdr.markForCheck();
        });
    }

    /**
     * Atualizar favoritos em lote
     */
    private updateFavoritesBatch(items: any[], type: 'channel' | 'movie' | 'series'): void {
        for (let i = 0; i < items.length; i++) {
            items[i].isFavorite = this.favoritesService.isFavorite(items[i].id, type);
        }
    }

    /**
     * Utilitários de progresso e controle
     */
    private updateProgress(current: number, total: number, stage: ProcessingProgress['stage'], customPercentage?: number): void {
        const percentage = customPercentage ?? Math.round((current / total) * 100);
        
        this.processingProgress$.next({
            current,
            total,
            percentage,
            stage
        });
        
        // Atualizar status visual
        if (stage !== 'complete') {
            this.loadStatus = {
                type: 'warning',
                icon: 'hourglass_empty',
                message: `${this.getStageMessage(stage)} ${percentage}%`
            };
        }
        
        this.cdr.markForCheck();
    }

    private getStageMessage(stage: ProcessingProgress['stage']): string {
        switch (stage) {
            case 'loading': return 'Carregando dados...';
            case 'processing': return 'Processando itens...';
            case 'grouping': return 'Organizando categorias...';
            case 'complete': return 'Concluído!';
            default: return 'Processando...';
        }
    }

    private resetProgress(): void {
        this.processingProgress$.next({
            current: 0,
            total: 0,
            percentage: 0,
            stage: 'loading'
        });
    }

    private abortProcessing(): void {
        if (this.processingAbortController) {
            this.processingAbortController.abort();
            this.processingAbortController = undefined;
        }
    }

    private async yieldToUI(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY));
    }

    /**
     * Gerenciamento de cache otimizado
     */
    private invalidateCache(type: keyof typeof this._cachedCounts): void {
        delete this._cachedCounts[type];
    }

    private invalidateAllCaches(): void {
        this._cachedCounts = {};
    }

    /**
     * Métodos de toggle de interface
     */
    toggleChannels(): void {
        this.showChannels = !this.showChannels;
        this.cdr.markForCheck();
    }

    toggleMovies(): void {
        this.showMovies = !this.showMovies;
        this.cdr.markForCheck();
    }

    toggleSeries(): void {
        this.showSeries = !this.showSeries;
        this.cdr.markForCheck();
    }

    /**
     * Manipulação de arquivos otimizada
     */
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
            this.showSnackBar('Por favor, selecione um arquivo .m3u ou .m3u8', 'error');
            return;
        }

        this.loading = true;
        this.loadStatus = null;
        this.cdr.markForCheck();

        this.m3uParser.parseM3UFromFile(file).pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.uploadM3U(file);
                    this.m3uUrl = file.name;
                },
                error: (error) => {
                    this.handleLoadError(error);
                }
            });

        input.value = '';
    }

    /**
     * Upload otimizado de arquivo M3U
     */
    async uploadM3U(file: File): Promise<void> {
        try {
            const formData = new FormData();
            formData.append('playlist', file);

            const data = await this.functions.formPostExpress(formData, 'api/upload', true);

            if (data?.success === true) {
                this.snackBar.open('M3U enviado com sucesso', 'OK', { duration: 3000 });
                await this.loadM3U({});
            } else {
                console.error('Erro ao enviar M3U para o servidor:', data);
                this.snackBar.open('Erro ao enviar M3U para o servidor', 'OK', { duration: 5000 });
            }
        } catch (error) {
            console.error('Erro ao enviar M3U para o servidor:', error);
            this.snackBar.open('Erro ao enviar M3U para o servidor', 'OK', { duration: 5000 });
        } finally {
            this.loading = false;
            this.cdr.markForCheck();
        }
    }

    /**
     * Manipulação de itens da interface
     */
    selectItem(item: Channel | Movie | Series, type: 'channel' | 'movie' | 'series'): void {
        this.selectedItem = item;
        this.selectedItemType = type;
        this.showInfoPanel = true;
        this.cdr.markForCheck();
    }

    closeInfoPanel(): void {
        this.showInfoPanel = false;
        this.cdr.markForCheck();
    }

    /**
     * Métodos de contagem otimizados com cache
     */
    getChannelsCount(): number {
        if (this._cachedCounts.channels === undefined) {
            this._cachedCounts.channels = this.currentPlaylist?.channels.length || 0;
        }
        return this._cachedCounts.channels;
    }

    getMoviesCount(): number {
        if (this._cachedCounts.movies === undefined) {
            this._cachedCounts.movies = this.currentPlaylist?.movies.length || 0;
        }
        return this._cachedCounts.movies;
    }

    getSeriesCount(): number {
        if (this._cachedCounts.series === undefined) {
            if (!this.currentPlaylist?.series.length) {
                this._cachedCounts.series = 0;
            } else {
                const uniqueSeries = new Set(
                    this.currentPlaylist.series.map(serie => serie.title || 'Série Desconhecida')
                );
                this._cachedCounts.series = uniqueSeries.size;
            }
        }
        return this._cachedCounts.series;
    }

    getFavoritesCount(): number {
        if (this._cachedCounts.favorites === undefined) {
            this._cachedCounts.favorites = this.favoritesService.getFavoritesCount();
        }
        return this._cachedCounts.favorites;
    }

    /**
     * Getters e utilitários
     */
    get playlistData(): M3UPlaylist | null {
        return this.currentPlaylist;
    }

    getSelectedItemTitle(): string {
        if (!this.selectedItem) return '';
        return this.selectedItem.title;
    }

    getChannelsBySubType(subType: string): Channel[] {
        return this.groupedChannels[subType] || [];
    }

    getMoviesByGenre(genre: string): Movie[] {
        return this.groupedMovies[genre] || [];
    }

    getSeriesByName(name: string): Series[] {
        return this.groupedSeries[name] || [];
    }

    get channelGroups(): Record<string, Channel[]> {
        return this.groupedChannels;
    }

    get movieGroups(): Record<string, Movie[]> {
        return this.groupedMovies;
    }

    get seriesGroups(): Record<string, Series[]> {
        return this.groupedSeries;
    }

    /**
     * Métodos auxiliares privados
     */
    private handleLoadError(error: any): void {
        this.loading = false;
        console.error('Erro ao carregar M3U:', error);

        const errorMessage = error.message || 'Erro ao carregar a lista. Verifique a URL/arquivo e tente novamente.';
        this.showSnackBar(errorMessage, 'error');
        this.cdr.markForCheck();
    }

    private showSnackBar(message: string, type: 'success' | 'error' | 'warning'): void {
        const config = {
            duration: type === 'error' ? 6000 : 4000,
            panelClass: [`snackbar-${type}`]
        };

        this.snackBar.open(message, 'Fechar', config);
    }

    private loadSavedM3UUrl(): void {
        try {
            const savedUrl = sessionStorage.getItem('webplayer_m3u_url');
            if (savedUrl) {
                this.m3uUrl = savedUrl;
            }
        } catch (error) {
            console.warn('Erro ao carregar URL M3U salva:', error);
        }
    }

    /**
     * Debug: estatísticas de performance
     */
    getPerformanceStats(): any {
        return {
            cacheHits: Object.keys(this._cachedCounts).length,
            itemCounts: {
                channels: this.getChannelsCount(),
                movies: this.getMoviesCount(),
                series: this.getSeriesCount(),
                favorites: this.getFavoritesCount()
            },
            memoryUsage: (performance as any).memory ? {
                used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024)
            } : 'N/A'
        };
    }
}