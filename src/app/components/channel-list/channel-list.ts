import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, filter } from 'rxjs';

import { Channel, Movie, Series, M3UPlaylist } from '../../models/interfaces';
import { FavoritesService } from '../../services/favorites';
import { AppComponent } from '../../app';
import { environment } from '../../../environments/environment';
import { Functions } from '../../../functions';

@Component({
    selector: 'app-channel-list',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './channel-list.html',
    styleUrls: ['./channel-list.scss']
})
export class ChannelListComponent implements OnInit, OnDestroy, OnChanges {
    @Input() playlist: M3UPlaylist | null = null;
    @Input() searchTerm = '';
    @Input() currentView: 'channels' | 'movies' | 'series' | 'favorites' = 'channels';

    @Output() itemSelected = new EventEmitter<{item: Channel | Movie | Series, type: 'channel' | 'movie' | 'series'}>();

    filteredItems: (Channel | Movie | Series)[] = [];
    loading = false;
    currentRoute = '';
    currentType  = '';

    private destroy$ = new Subject<void>();

    constructor(
        private favoritesService: FavoritesService,
        private router: Router,
        public appComponent: AppComponent,
        private functions: Functions
    ) {}

    ngOnInit(): void {
        // Detectar rota atual
        this.currentRoute = this.router.url.split('/')[1] || 'channels';

        // Escutar mudanças nos favoritos
        this.favoritesService.favorites$.pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.updateFilteredItems();
        });

        // Escutar mudanças na rota
        this.router.events.pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.currentRoute = this.router.url.split('/')[1] || 'channels';
            this.playlist = this.appComponent.playlistData;
            this.updateFilteredItems();
        });

        // Verificar se os dados estão disponíveis
        this.initializeData();
    }

    private initializeData(): void {
        // Verifica se os dados estão disponíveis
        if (this.appComponent.playlistData) {
            this.playlist = this.appComponent.playlistData;
            this.updateFilteredItems();
        } else {
            // Se não estão, aguarda até estarem disponíveis
            this.waitForPlaylistData();
        }
    }

    private waitForPlaylistData(): void {
        // Verifica periodicamente se os dados estão disponíveis
        const checkData = () => {
            if (this.appComponent.playlistData) {
                this.playlist = this.appComponent.playlistData;
                this.updateFilteredItems();
            } else {
                setTimeout(checkData, 500);
            }
        };
        checkData();
    }

    ngOnChanges(): void {
        this.updateFilteredItems();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onItemClick(item: Channel | Movie | Series): void {
        const type = this.getItemType(item);
        this.itemSelected.emit({ item, type });
        
        // Também notificar o componente pai diretamente
        this.appComponent.selectItem(item, type);
    }

    toggleFavorite(item: Channel | Movie | Series, event: Event): void {
        event.stopPropagation();
        const type = this.getItemType(item);
        this.favoritesService.toggleFavorite(item, type);
    }

    isFavorite(item: Channel | Movie | Series): boolean {
        const type = this.getItemType(item);
        return this.favoritesService.isFavorite(item.id, type);
    }

    getItemName(item: Channel | Movie | Series): string {
        return item.title;
    }

    getItemImage(item: Channel | Movie | Series): string {
        if (item.tvg_logo) {
            return environment.API_URL + item.tvg_logo;
        }

        return '/assets/default.webp';
    }

    getItemSubtitle(item: Channel | Movie | Series): string {
        if ('group' in item) {
            return item.item_type || 'Canal';
        } else if ('genre' in item) {
            return item.genre || 'Sem gênero';
        }

        return '';
    }

    private getItemType(item: Channel | Movie | Series): 'channel' | 'movie' | 'series' {
        if (item.item_type === 'channel') {
            return 'channel';
        } else if (item.item_type === 'movie') {
            return 'movie';
        } else if (item.item_type === 'series') {
            return 'series';
        }

        return 'channel';
    }

    private updateFilteredItems(): void {
        const route = this.router.url.split('/');
        const currentRoute = route[route.length - 1];

        if (currentRoute === 'channels' || currentRoute === 'movies' || currentRoute === 'series') {
            return;
        }

        this.currentType  = this.router.url.split('/')[2] || '';

        if (!this.playlist) {
            this.filteredItems = [];
            return;
        }

        let items: (Channel | Movie | Series)[] = [];

        // Selecionar itens baseado na rota atual
        switch (this.currentRoute) {
            case 'channels':
                items = [...this.playlist.channels];
                break;
            case 'movies':
                items = [...this.playlist.movies];
                break;
            case 'series':
                items = [...this.playlist.series];
                break;
            case 'favorites':
                items = this.getFavoriteItems();
                break;
            default:
                items = [...this.playlist.channels];
        }

        // Filtrar por subtipo, se definido
        if (this.currentType) {
            items = items.filter(item => 
                this.functions.sanitizeKey(item.item_subtype ?? '') === this.currentType
            );
        }

        // Aplicar filtro de busca
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();

            items = items.filter(item => {
                const name = item.title;
                const group = item.genre;
                return name.toLowerCase().includes(term) || (group && group.toLowerCase().includes(term));
            });
        }

        this.filteredItems = items;
    }

    private getFavoriteItems(): (Channel | Movie | Series)[] {
        if (!this.playlist) {
            return [];
        }

        const favorites: (Channel | Movie | Series)[] = [];

        // Adicionar canais favoritos
        this.playlist.channels.forEach(channel => {
            if (this.favoritesService.isFavorite(channel.id, 'channel')) {
                favorites.push(channel);
            }
        });

        // Adicionar filmes favoritos
        this.playlist.movies.forEach(movie => {
            if (this.favoritesService.isFavorite(movie.id, 'movie')) {
                favorites.push(movie);
            }
        });

        // Adicionar séries favoritas
        this.playlist.series.forEach(series => {
            if (this.favoritesService.isFavorite(series.id, 'series')) {
                favorites.push(series);
            }
        });

        return favorites;
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        img.src = '/assets/default.webp';
    }

    getItemTitle(item: Channel | Movie | Series): string {
        return this.getItemName(item);
    }

    hasAdditionalInfo(item: Channel | Movie | Series): boolean {
        return this.getYear(item) !== null || this.getDuration(item) !== null || this.getSeasons(item) !== null;
    }

    getYear(item: Channel | Movie | Series): number | null {
        if ('year' in item && item.year) {
            return item.year;
        }

        return null;
    }

    getDuration(item: Channel | Movie | Series): string | null {
        if ('duration' in item && item.duration) {
            return item.duration;
        }

        return null;
    }

    getSeasons(item: Channel | Movie | Series): number | null {
        if ('seasons' in item && item.seasons) {
            return item.seasons;
        }

        return null;
    }

    getEmptyStateTitle(): string {
        switch (this.currentRoute) {
            case 'channels':
                return 'Canais';
            case 'movies':
                return 'Filmes';
            case 'series':
                return 'Séries';
            case 'favorites':
                return 'Favoritos';
            default:
                return 'Itens';
        }
    }

    trackByFn(index: number, item: Channel | Movie | Series): string {
        return item.id;
    }

    getTypeIcon(item: Channel | Movie | Series): string {
        const type = this.getItemType(item);
        switch (type) {
            case 'channel': 
                return 'tv';
            case 'movie': 
                return 'movie';
            case 'series': 
                return 'tv_gen';
            default: 
                return 'play_circle';
        }
    }

    getEmptyStateMessage(): string {
        switch (this.currentRoute) {
            case 'channels':
                return this.playlist ? 'Nenhum canal encontrado' : 'Carregue uma lista M3U para ver os canais disponíveis';
            case 'movies':
                return this.playlist ? 'Nenhum filme encontrado' : 'Carregue uma lista M3U para ver os filmes disponíveis';
            case 'series':
                return this.playlist ? 'Nenhuma série encontrada' : 'Carregue uma lista M3U para ver as séries disponíveis';
            case 'favorites':
                return 'Nenhum item favoritado ainda';
            default:
                return 'Nenhum item encontrado';
        }
    }

    getEmptyStateIcon(): string {
        switch (this.currentRoute) {
            case 'channels':
                return 'tv';
            case 'movies':
                return 'movie';
            case 'series':
                return 'tv_gen';
            case 'favorites':
                return 'favorite_border';
            default:
                return 'inbox';
        }
    }
}