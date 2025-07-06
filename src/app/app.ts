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
import { Subject, takeUntil, filter, debounceTime, BehaviorSubject, take } from 'rxjs';

import { HeaderComponent } from './components/header/header';
import { SidePanelComponent } from './components/side-panel/side-panel';

import { FavoritesService } from './services/favorites';
import { ThemeService } from './services/theme';

import { Channel, Movie, Series, M3UPlaylist } from './models/interfaces';
import { Functions } from '../functions';
import { environment } from '../environments/environment';
import { AuthService } from './auth/auth.service';
import { ImportList } from './components/import-list/import-list';
import { MatDialog } from '@angular/material/dialog';

// Imports para cache de logos
import { LogoCacheService } from './services/local-cache';

interface LoadStatus {
    type: 'success' | 'error' | 'warning';
    icon: string;
    message: string;
}

interface GroupedItems<T> {
    key: string;
    originalKey: string;
    displayName: string;
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
    private readonly BATCH_SIZE = 100;
    private readonly PROCESSING_DELAY = 16;
    
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

    // Propriedades para cache de logos
    private logoPreloadInProgress = false;
    private logosCacheStats: any = null;

    // Propriedades para templates (adicionadas)
    isDevelopment = !environment.production;
    showDebugInfo = !environment.production;
    showCacheNotification = false;
    cacheNotificationType: 'success' | 'warning' | 'error' = 'success';
    cacheNotificationMessage = '';
    skeletonItems = Array(12).fill(null);
    searchResults: any[] = [];

    isLogedIn = false;
    private destroy$ = new Subject<void>();
    private processingAbortController?: AbortController;

    constructor(
        private favoritesService: FavoritesService,
        public themeService: ThemeService,
        private router: Router,
        private snackBar: MatSnackBar,
        public functions: Functions,
        private authService: AuthService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private logoCacheService: LogoCacheService
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

        // Iniciar monitoramento de cache de logos
        this.startCacheMonitoring();

        setTimeout(() => {
            this.expandMenu();
        }, 500);
    }

    expandMenu() {
        // Se a rota contém um submenu, expandir o menu pai
        const currentUrl = this.router.url;

        if (currentUrl.includes('/channels/') && currentUrl.split('/').length > 2) {
            this.showChannels = true;
        }

        if (currentUrl.includes('/movies/') && currentUrl.split('/').length > 2) {
            this.showMovies = true;
        }

        if (currentUrl.includes('/series/') && currentUrl.split('/').length > 2) {
            this.showSeries = true;
        }

        this.cdr.markForCheck();
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
     * Carregamento principal otimizado com processamento assíncrono - VERSÃO SUPER OTIMIZADA
     */
    async loadM3U(filter: { search?: string; field?: string; type?: 'channel' | 'movie' | 'series'}): Promise<void> {
        if (this.router.url === '/auth/login') {
            return;
        }

        // Abortar processamento anterior
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

            if (result?.success && result.data) {
                const items = result.data as any[];
                
                if (this.processingAbortController?.signal.aborted) {
                    return;
                }

                console.log(`Iniciando processamento de ${items.length} itens...`);

                // Processamento otimizado - priorizar método assíncrono sobre Web Workers
                if (items.length > 100000) {
                    // Para volumes muito grandes, tentar Web Worker primeiro
                    try {
                        await this.processWithWebWorker(items);
                    } catch (error) {
                        console.warn('Web Worker falhou, usando processamento assíncrono:', error);
                        await this.processPlaylistDataSuperOptimized(items);
                    }
                } else {
                    // Para volumes grandes mas gerenciáveis, usar processamento assíncrono otimizado
                    await this.processPlaylistDataSuperOptimized(items);
                }

                if (this.processingAbortController?.signal.aborted) {
                    return;
                }

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
     * Processamento super otimizado para grandes volumes
     */
    private async processPlaylistDataSuperOptimized(items: any[]): Promise<void> {
        const channels: Channel[] = [];
        const movies: Movie[] = [];
        const series: Series[] = [];

        let processed = 0;
        const total = items.length;
        const SUPER_BATCH_SIZE = Math.min(10000, Math.max(1000, Math.floor(total / 50))); // Lote adaptativo
        const PROGRESS_UPDATE_INTERVAL = Math.max(5000, Math.floor(total / 100)); // Intervalo adaptativo

        this.updateProgress(0, total, 'processing');

        // Para volumes muito grandes, usar processamento com requestIdleCallback se disponível
        if (total > 100000 && 'requestIdleCallback' in window) {
            await this.processWithIdleCallback(items);
            return;
        }

        // Primeira passada: classificar e coletar URLs de logos
        const logoUrls: string[] = [];

        for (let i = 0; i < items.length; i++) {
            if (this.processingAbortController?.signal.aborted) {
                throw new Error('Processing aborted');
            }

            const item = items[i];
            const itemType = item.item_type;
            
            if (itemType === 'channel') {
                channels.push(item);
                // Coletar URL do logo se existir
                if (item.logo_url && this.isValidLogoUrl(item.logo_url)) {
                    logoUrls.push(item.logo_url);
                }
            } else if (itemType === 'movie') {
                movies.push(item);
                if (item.poster_url && this.isValidLogoUrl(item.poster_url)) {
                    logoUrls.push(item.poster_url);
                }
            } else if (itemType === 'series') {
                series.push(item);
                if (item.poster_url && this.isValidLogoUrl(item.poster_url)) {
                    logoUrls.push(item.poster_url);
                }
            }

            processed++;

            // Atualizar progresso e yield periodicamente
            if (processed % PROGRESS_UPDATE_INTERVAL === 0) {
                const progressPercentage = Math.round((processed / total) * 60); // 60% para processamento
                this.updateProgress(processed, total, 'processing', progressPercentage);
                
                if (total > 50000) {
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                } else {
                    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                }
            }
        }

        this.updateProgress(total, total, 'processing', 60);

        // Criar playlist
        this.currentPlaylist = { channels, movies, series };

        // Agrupar de forma otimizada
        await this.groupAllItemsSuperOptimized();

        this.updateProgress(total, total, 'processing', 80);

        // Pré-carregar logos em background (não bloquear UI)
        this.preloadLogosInBackground(logoUrls);

        this.updateProgress(total, total, 'complete', 100);
        
        console.log(`Processamento concluído:`, {
            channels: channels.length,
            movies: movies.length,
            series: series.length,
            total: channels.length + movies.length + series.length,
            logoUrls: logoUrls.length,
            batchSize: SUPER_BATCH_SIZE,
            updateInterval: PROGRESS_UPDATE_INTERVAL
        });
    }

    /**
     * Processamento com requestIdleCallback para volumes extremos
     */
    private async processWithIdleCallback(items: any[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const channels: Channel[] = [];
            const movies: Movie[] = [];
            const series: Series[] = [];

            let currentIndex = 0;
            const batchSize = 5000;

            const processChunk = (deadline?: IdleDeadline) => {
                try {
                    const startTime = performance.now();
                    
                    while (currentIndex < items.length && 
                           (!deadline || deadline.timeRemaining() > 0 || 
                            performance.now() - startTime < 16)) {
                        
                        if (this.processingAbortController?.signal.aborted) {
                            reject(new Error('Processing aborted'));
                            return;
                        }

                        const item = items[currentIndex];
                        const itemType = item.item_type;
                        
                        if (itemType === 'channel') {
                            channels.push(item);
                        } else if (itemType === 'movie') {
                            movies.push(item);
                        } else if (itemType === 'series') {
                            series.push(item);
                        }

                        currentIndex++;

                        // Atualizar progresso a cada lote
                        if (currentIndex % batchSize === 0) {
                            const percentage = Math.round((currentIndex / items.length) * 75);
                            this.updateProgress(currentIndex, items.length, 'processing', percentage);
                        }
                    }

                    if (currentIndex < items.length) {
                        // Continuar processamento no próximo idle
                        (window as any).requestIdleCallback(processChunk, { timeout: 50 });
                    } else {
                        // Processamento concluído
                        this.currentPlaylist = { channels, movies, series };
                        this.groupAllItemsSuperOptimized().then(resolve).catch(reject);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            // Iniciar processamento
            (window as any).requestIdleCallback(processChunk, { timeout: 50 });
        });
    }

    /**
     * Agrupamento super otimizado
     */
    private async groupAllItemsSuperOptimized(): Promise<void> {
        if (!this.currentPlaylist) return;

        this.updateProgress(0, 100, 'grouping', 80);

        // Usar Map para melhor performance em grandes volumes
        const channelGroups = new Map<string, Channel[]>();
        const movieGroups = new Map<string, Movie[]>();
        const seriesGroups = new Map<string, Series[]>();

        // Processar canais
        for (const channel of this.currentPlaylist.channels) {
            const subType = (channel.item_subtype || 'Outros').trim();
            if (!channelGroups.has(subType)) {
                channelGroups.set(subType, []);
            }
            channelGroups.get(subType)!.push(channel);
        }

        // Processar filmes
        for (const movie of this.currentPlaylist.movies) {
            const subType = (movie.item_subtype || 'Outros').trim();
            if (!movieGroups.has(subType)) {
                movieGroups.set(subType, []);
            }
            movieGroups.get(subType)!.push(movie);
        }

        // Processar séries
        for (const serie of this.currentPlaylist.series) {
            const seriesName = (serie.title || 'Série Desconhecida').trim();
            if (!seriesGroups.has(seriesName)) {
                seriesGroups.set(seriesName, []);
            }
            seriesGroups.get(seriesName)!.push(serie);
        }

        // Converter Maps para Records
        this.groupedChannels = Object.fromEntries(channelGroups);
        this.groupedMovies = Object.fromEntries(movieGroups);
        this.groupedSeries = Object.fromEntries(seriesGroups);

        // Criar arrays ordenados
        this.sortedChannelGroups = this.sortGroupedItemsFast(channelGroups);
        this.sortedMovieGenres = this.sortGroupedItemsFast(movieGroups);
        this.sortedSeriesGroups = this.sortGroupedItemsFast(seriesGroups);

        this.updateProgress(100, 100, 'grouping', 90);
        this.cdr.markForCheck();
    }

    /**
     * Ordenação otimizada usando Map
     */
    private sortGroupedItemsFast<T>(groupedMap: Map<string, T[]>): GroupedItems<T>[] {
        const entries = Array.from(groupedMap.entries());
        
        return entries
            .map(([originalKey, value]) => ({ 
                key: this.functions.sanitizeKey(originalKey), 
                originalKey: originalKey,
                displayName: originalKey,
                value 
            }))
            .sort((a, b) => {
                const countDiff = b.value.length - a.value.length;
                return countDiff !== 0 ? countDiff : a.displayName.localeCompare(b.displayName);
            });
    }

    /**
     * Processamento com Web Worker para volumes muito grandes
     */
    private async processWithWebWorker(items: any[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Verificar se Web Workers são suportados
            if (typeof Worker === 'undefined') {
                console.warn('Web Workers não suportados, usando processamento normal');
                this.processPlaylistDataSuperOptimized(items).then(resolve).catch(reject);
                return;
            }

            try {
                const workerScript = `
                    self.onmessage = function(e) {
                        const { items, batchSize } = e.data;
                        const channels = [];
                        const movies = [];
                        const series = [];
                        
                        let processed = 0;
                        
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            
                            if (item.item_type === 'channel') {
                                channels.push(item);
                            } else if (item.item_type === 'movie') {
                                movies.push(item);
                            } else if (item.item_type === 'series') {
                                series.push(item);
                            }
                            
                            processed++;
                            
                            // Reportar progresso a cada lote
                            if (processed % batchSize === 0) {
                                self.postMessage({
                                    type: 'progress',
                                    processed,
                                    total: items.length,
                                    percentage: Math.round((processed / items.length) * 100)
                                });
                            }
                        }
                        
                        self.postMessage({
                            type: 'complete',
                            result: { channels, movies, series }
                        });
                    };
                `;

                const blob = new Blob([workerScript], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                const worker = new Worker(workerUrl);

                worker.onmessage = (e) => {
                    const { type, result, processed, total, percentage } = e.data;
                    
                    if (type === 'progress') {
                        this.updateProgress(processed, total, 'processing', percentage);
                    } else if (type === 'complete') {
                        this.currentPlaylist = result;
                        this.groupAllItemsSuperOptimized().then(() => {
                            worker.terminate();
                            URL.revokeObjectURL(workerUrl);
                            resolve();
                        }).catch(reject);
                    }
                };

                worker.onerror = (error) => {
                    console.error('Erro no Web Worker:', error);
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    // Fallback para processamento normal
                    this.processPlaylistDataSuperOptimized(items).then(resolve).catch(reject);
                };

                worker.postMessage({
                    items,
                    batchSize: 10000
                });

            } catch (error) {
                console.error('Erro ao criar Web Worker:', error);
                // Fallback para processamento normal
                this.processPlaylistDataSuperOptimized(items).then(resolve).catch(reject);
            }
        });
    }

    /**
     * Processamento otimizado em lotes com controle de abort (MÉTODO ORIGINAL MANTIDO COMO FALLBACK)
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
     * Agrupamento otimizado e assíncrono (MÉTODO ORIGINAL MANTIDO COMO FALLBACK)
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
            .map(([originalKey, value]) => ({ 
                key: this.functions.sanitizeKey(originalKey), 
                originalKey: originalKey, // Mantém a chave original
                displayName: originalKey,
                value 
            }))
            .sort((a, b) => {
                const countDiff = b.value.length - a.value.length;
                return countDiff !== 0 ? countDiff : a.displayName.localeCompare(b.displayName);
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

    public importM3U(): void {
        const dialogRef = this.dialog.open(ImportList, {
            width: '400px',
            data: {
                title: 'Confirmar Ação',
                content: 'Tem certeza que deseja continuar?',
                confirmText: 'Sim',
                cancelText: 'Não'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            this.snackBar.open(result.message, 'Fechar');

            if (result) {
                console.log('Usuário confirmou');
                this.loadM3U({});
            } else {
                console.log('Usuário cancelou');
            }
        });
    }

    /**
     * Utilitários de progresso e controle - VERSÃO OTIMIZADA
     */
    private updateProgress(current: number, total: number, stage: ProcessingProgress['stage'], customPercentage?: number): void {
        const percentage = customPercentage ?? (total > 0 ? Math.round((current / total) * 100) : 0);
        
        this.processingProgress$.next({
            current,
            total,
            percentage,
            stage
        });
        
        // Atualizar status visual menos frequentemente
        if (stage !== 'complete' && (current % 5000 === 0 || customPercentage !== undefined)) {
            this.loadStatus = {
                type: 'warning',
                icon: 'hourglass_empty',
                message: `${this.getStageMessage(stage)} ${percentage}%`
            };
            
            // Usar markForCheck apenas quando necessário
            this.cdr.markForCheck();
        }
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
        return new Promise<void>(resolve => setTimeout(resolve, this.PROCESSING_DELAY));
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

    isChannelsActive(): boolean {
        return this.router.url.startsWith('/channels');
    }

    isRouteActive(route: string): boolean {
        return this.router.url === route;
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

    /**
     * Método para monitorar performance em tempo real
     */
    logPerformanceMetrics(): void {
        if (this.currentPlaylist) {
            const stats = this.getPerformanceStats();
            console.log('Performance Stats:', stats);
            
            // Log específico para grandes volumes
            if (stats.itemCounts.channels + stats.itemCounts.movies + stats.itemCounts.series > 100000) {
                console.warn('Large dataset detected. Consider implementing virtual scrolling for better performance.');
            }
        }
    }

    /**
     * Método para limpar dados e liberar memória
     */
    clearPlaylistData(): void {
        this.currentPlaylist = null;
        this.groupedChannels = {};
        this.groupedMovies = {};
        this.groupedSeries = {};
        this.sortedChannelGroups = [];
        this.sortedMovieGenres = [];
        this.sortedSeriesGroups = [];
        this.invalidateAllCaches();
        this.cdr.markForCheck();
        
        // Forçar garbage collection se disponível
        if ((window as any).gc) {
            (window as any).gc();
        }
    }

    /**
     * MÉTODOS PARA CACHE DE LOGOS
     */

    /**
     * Pré-carregar logos em background sem bloquear UI
     */
    private async preloadLogosInBackground(logoUrls: string[]): Promise<void> {
        if (this.logoPreloadInProgress || !logoUrls.length) {
            return;
        }

        this.logoPreloadInProgress = true;

        try {
            // Remover duplicatas e filtrar URLs válidas
            const uniqueUrls = [...new Set(logoUrls)].filter(url => this.isValidLogoUrl(url));

            if (uniqueUrls.length === 0) {
                return;
            }

            console.log(`Iniciando pré-carregamento de ${uniqueUrls.length} logos...`);

            // Aguardar cache estar pronto
            await this.logoCacheService.isCacheReady().pipe(
                filter(ready => ready),
                take(1)
            ).toPromise();

            // Pré-carregar em lotes pequenos para não sobrecarregar
            const batchSize = 10;
            let loadedCount = 0;

            for (let i = 0; i < uniqueUrls.length; i += batchSize) {
                if (this.processingAbortController?.signal.aborted) {
                    break;
                }

                const batch = uniqueUrls.slice(i, i + batchSize);
                
                await this.logoCacheService.preloadLogos(batch, 3).catch(error => {
                    console.warn('Erro no pré-carregamento de lote:', error);
                });

                loadedCount += batch.length;

                // Atualizar status periodicamente
                if (loadedCount % 50 === 0) {
                    const progress = Math.round((loadedCount / uniqueUrls.length) * 100);
                    console.log(`Pré-carregamento: ${loadedCount}/${uniqueUrls.length} (${progress}%)`);
                }

                // Pequena pausa para não sobrecarregar
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }

            // Obter estatísticas finais
            this.logosCacheStats = this.logoCacheService.getCacheStats();
            
            console.log('Pré-carregamento de logos concluído:', this.logosCacheStats);

        } catch (error) {
            console.error('Erro no pré-carregamento de logos:', error);
        } finally {
            this.logoPreloadInProgress = false;
        }
    }

    /**
     * Validar URL de logo
     */
    private isValidLogoUrl(url: string): boolean {
        if (!url || typeof url !== 'string') {
            return false;
        }

        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Obter estatísticas do cache de logos
     */
    getLogoCacheStats(): any {
        return this.logoCacheService.getCacheStats();
    }

    /**
     * Limpar cache de logos
     */
    async clearLogoCache(): Promise<void> {
        try {
            await this.logoCacheService.clearCache();
            this.showCacheNotificationMessage('Cache de logos limpo com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            this.showCacheNotificationMessage('Erro ao limpar cache de logos', 'error');
        }
    }

    /**
     * Limpar cache expirado
     */
    async cleanExpiredLogos(): Promise<void> {
        try {
            const removed = await this.logoCacheService.cleanExpiredCache();
            if (removed > 0) {
                this.showCacheNotificationMessage(`${removed} logos expirados removidos`, 'success');
            } else {
                this.showCacheNotificationMessage('Nenhum logo expirado encontrado', 'success');
            }
        } catch (error) {
            console.error('Erro ao limpar logos expirados:', error);
            this.showCacheNotificationMessage('Erro ao limpar logos expirados', 'error');
        }
    }

    /**
     * Exportar informações do cache
     */
    exportCacheInfo(): void {
        const cacheInfo = {
            ...this.logoCacheService.getCacheInfo(),
            performance: this.getPerformanceStats(),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(cacheInfo, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logo-cache-info-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showCacheNotificationMessage('Informações do cache exportadas!', 'success');
    }

    /**
     * Forçar re-download de um logo específico
     */
    async refreshLogo(logoUrl: string): Promise<void> {
        if (!logoUrl) return;

        try {
            // Recarregar
            this.logoCacheService.getLogo(logoUrl).subscribe({
                next: (dataUrl) => {
                    if (dataUrl) {
                        this.showCacheNotificationMessage('Logo atualizado com sucesso', 'success');
                    }
                },
                error: (error) => {
                    console.error('Erro ao atualizar logo:', error);
                    this.showCacheNotificationMessage('Erro ao atualizar logo', 'error');
                }
            });
        } catch (error) {
            console.error('Erro ao refresh do logo:', error);
        }
    }

    /**
     * Verificar saúde do cache
     */
    checkCacheHealth(): any {
        const stats = this.logoCacheService.getCacheStats();
        const info = this.logoCacheService.getCacheInfo();
        
        const health = {
            status: 'healthy',
            issues: [] as string[],
            recommendations: [] as string[],
            stats,
            info
        };

        // Verificar hit rate baixo
        if (stats.hitRate < 50 && stats.hits + stats.misses > 100) {
            health.status = 'warning';
            health.issues.push('Taxa de acerto baixa do cache');
            health.recommendations.push('Considere aumentar o tamanho do cache ou verificar URLs de logos');
        }

        // Verificar uso de memória alto
        const memoryUsage = (stats.totalSize / (50 * 1024 * 1024)) * 100; // % do limite
        if (memoryUsage > 80) {
            health.status = 'warning';
            health.issues.push('Uso de memória alto');
            health.recommendations.push('Execute limpeza de cache expirado');
        }

        // Verificar muitos itens
        if (stats.totalItems > 800) {
            health.issues.push('Muitos itens no cache');
            health.recommendations.push('Cache próximo do limite máximo');
        }

        return health;
    }

    /**
     * Otimizar cache automaticamente
     */
    async optimizeCache(): Promise<void> {
        try {
            this.showCacheNotificationMessage('Otimizando cache...', 'warning');
            
            const removed = await this.logoCacheService.cleanExpiredCache();
            const health = this.checkCacheHealth();
            
            let message = `Otimização concluída. ${removed} itens removidos.`;
            let type: 'success' | 'warning' | 'error' = 'success';
            
            if (health.status === 'warning') {
                message += ` Atenção: ${health.issues.join(', ')}`;
                type = 'warning';
            }

            this.showCacheNotificationMessage(message, type);
            
        } catch (error) {
            console.error('Erro na otimização:', error);
            this.showCacheNotificationMessage('Erro durante otimização do cache', 'error');
        }
    }

    /**
     * Método para monitorar performance do cache em tempo real
     */
    startCacheMonitoring(): void {
        // Verificar cache a cada 5 minutos
        setInterval(() => {
            const health = this.checkCacheHealth();
            if (health.status === 'warning' && health.issues.length > 0) {
                console.warn('Cache Health Warning:', health.issues);
            }
        }, 5 * 60 * 1000);

        // Limpeza automática de expirados a cada hora
        setInterval(() => {
            this.logoCacheService.cleanExpiredCache().catch(error => {
                console.error('Erro na limpeza automática:', error);
            });
        }, 60 * 60 * 1000);
    }

    /**
     * MÉTODOS ADICIONAIS PARA TEMPLATES
     */

    /**
     * Obter tamanho responsivo do logo
     */
    getLogoSize(): number {
        const screenWidth = window.innerWidth;
        if (screenWidth < 600) return 32;
        if (screenWidth < 960) return 48;
        return 64;
    }

    /**
     * Obter logo do primeiro canal de um grupo
     */
    getFirstChannelLogo(channels: Channel[]): string {
        return channels && channels.length > 0 ? channels[0].tvg_logo || '' : '';
    }

    /**
     * Obter poster do primeiro filme de um gênero
     */
    getFirstMoviePoster(movies: Movie[]): string {
        return movies && movies.length > 0 ? movies[0].tvg_logo || '' : '';
    }

    /**
     * TrackBy functions para performance
     */
    trackByGenre(index: number, item: GroupedItems<Movie>): string {
        return item.key;
    }

    trackByMovie(index: number, item: Movie): string {
        return item.id?.toString() || index.toString();
    }

    trackByChannel(index: number, item: Channel): string {
        return item.id?.toString() || index.toString();
    }

    trackBySeries(index: number, item: Series): string {
        return item.id?.toString() || index.toString();
    }

    /**
     * Formatar bytes para exibição
     */
    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Selecionar filme
     */
    selectMovie(movie: Movie): void {
        this.selectItem(movie, 'movie');
    }

    /**
     * Reproduzir canal
     */
    playChannel(channel: Channel): void {
        console.log('Playing channel:', channel.title);
        this.selectItem(channel, 'channel');
    }

    /**
     * Toggle favorito
     */
    toggleFavorite(item: Channel | Movie | Series): void {
        const type = this.getItemType(item);
        if (item.isFavorite) {
            this.favoritesService.removeFromFavorites(item.id, type);
        } else {
            this.favoritesService.addToFavorites(item, type);
        }
        item.isFavorite = !item.isFavorite;
        this.cdr.markForCheck();
    }

    /**
     * Determinar tipo do item
     */
    private getItemType(item: any): 'channel' | 'movie' | 'series' {
        if (item.item_type) {
            return item.item_type;
        }
        // Fallback baseado em propriedades
        if (item.logo_url) return 'channel';
        if (item.poster_url) return item.title?.includes('S0') ? 'series' : 'movie';
        return 'channel';
    }

    /**
     * Atualizar logo de um grupo de canais
     */
    refreshChannelGroupLogo(group: GroupedItems<Channel>): void {
        const firstChannel = group.value[0];
        if (firstChannel?.tvg_logo) {
            this.refreshLogo(firstChannel.tvg_logo);
        }
    }

    /**
     * MÉTODOS PARA CACHE HEALTH
     */

    /**
     * Obter classe CSS para health status
     */
    getCacheHealthClass(): string {
        const health = this.checkCacheHealth();
        return `cache-health-${health.status}`;
    }

    /**
     * Obter ícone para health status
     */
    getCacheHealthIcon(): string {
        const health = this.checkCacheHealth();
        switch (health.status) {
            case 'healthy': return 'check_circle';
            case 'warning': return 'warning';
            case 'poor': return 'error';
            default: return 'help';
        }
    }

    /**
     * Obter mensagem de health status
     */
    getCacheHealthMessage(): string {
        const health = this.checkCacheHealth();
        switch (health.status) {
            case 'healthy': return 'Cache funcionando perfeitamente';
            case 'warning': return `Atenção: ${health.issues.join(', ')}`;
            case 'poor': return 'Cache com problemas críticos';
            default: return 'Status desconhecido';
        }
    }

    /**
     * MÉTODOS PARA NOTIFICAÇÕES DE CACHE
     */

    /**
     * Mostrar notificação de cache
     */
    showCacheNotificationMessage(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
        this.cacheNotificationMessage = message;
        this.cacheNotificationType = type;
        this.showCacheNotification = true;
        this.cdr.markForCheck();

        // Auto dismiss após 5 segundos
        setTimeout(() => {
            this.dismissCacheNotification();
        }, 5000);
    }

    /**
     * Dispensar notificação
     */
    dismissCacheNotification(): void {
        this.showCacheNotification = false;
        this.cdr.markForCheck();
    }

    /**
     * Obter ícone da notificação
     */
    getCacheNotificationIcon(): string {
        switch (this.cacheNotificationType) {
            case 'success': return 'check_circle';
            case 'warning': return 'warning';
            case 'error': return 'error';
            default: return 'info';
        }
    }

    /**
     * MÉTODOS PARA BUSCA
     */

    /**
     * Buscar itens
     */
    searchItems(searchTerm: string): void {
        if (!searchTerm || searchTerm.length < 2) {
            this.searchResults = [];
            return;
        }

        this.searchResults = this.performSearch(searchTerm);
        this.cdr.markForCheck();
    }

    /**
     * Realizar busca nos dados
     */
    private performSearch(term: string): any[] {
        if (!this.currentPlaylist) return [];

        const results: any[] = [];
        const searchTerm = term.toLowerCase();

        // Buscar canais
        this.currentPlaylist.channels.forEach(channel => {
            if (channel.title?.toLowerCase().includes(searchTerm) ||
                channel.item_subtype?.toLowerCase().includes(searchTerm)) {
                results.push({
                    ...channel,
                    searchType: 'channel'
                });
            }
        });

        // Buscar filmes
        this.currentPlaylist.movies.forEach(movie => {
            if (movie.title?.toLowerCase().includes(searchTerm) ||
                movie.item_subtype?.toLowerCase().includes(searchTerm)) {
                results.push({
                    ...movie,
                    searchType: 'movie'
                });
            }
        });

        // Buscar séries
        this.currentPlaylist.series.forEach(series => {
            if (series.title?.toLowerCase().includes(searchTerm)) {
                results.push({
                    ...series,
                    searchType: 'series'
                });
            }
        });

        return results.slice(0, 50); // Limitar resultados
    }

    /**
     * Selecionar resultado da busca
     */
    selectSearchResult(result: any): void {
        this.selectItem(result, result.searchType);
        this.searchResults = []; // Limpar resultados
    }

    /**
     * Obter logo do resultado da busca
     */
    getResultLogo(result: any): string {
        switch (result.searchType) {
            case 'channel': return result.logo_url || '';
            case 'movie':
            case 'series': return result.poster_url || '';
            default: return '';
        }
    }

    /**
     * Obter ícone baseado no tipo
     */
    getResultIcon(type: string): string {
        switch (type) {
            case 'channel': return 'tv';
            case 'movie': return 'movie';
            case 'series': return 'tv_series';
            default: return 'image';
        }
    }

    /**
     * Exportar estatísticas em formato JSON
     */
    exportStats(): void {
        const stats = {
            timestamp: new Date().toISOString(),
            performance: this.getPerformanceStats(),
            cache: this.getLogoCacheStats(),
            groupStats: {
                channelGroups: Object.keys(this.groupedChannels).length,
                movieGroups: Object.keys(this.groupedMovies).length,
                seriesGroups: Object.keys(this.groupedSeries).length
            },
            topGroups: {
                channels: this.sortedChannelGroups.slice(0, 10).map(g => ({
                    name: g.displayName,
                    count: g.value.length
                })),
                movies: this.sortedMovieGenres.slice(0, 10).map(g => ({
                    name: g.displayName,
                    count: g.value.length
                })),
                series: this.sortedSeriesGroups.slice(0, 10).map(g => ({
                    name: g.displayName,
                    count: g.value.length
                }))
            }
        };

        const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `playlist-stats-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showCacheNotificationMessage('Estatísticas exportadas com sucesso!', 'success');
    }
}