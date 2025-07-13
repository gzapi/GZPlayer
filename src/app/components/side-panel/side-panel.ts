import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { Subject, takeUntil } from 'rxjs';

import { Channel, Movie, Series } from '../../models/interfaces';
import { ChannelInfoService, ChannelInfo, MovieInfo, SeriesInfo } from '../../services/channel-info';
import { FavoritesService } from '../../services/favorites';
import { EpgService, EPGProgram } from '../../services/epg';

@Component({
    selector: 'app-side-panel',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        MatListModule
    ],
    templateUrl: './side-panel.html',
    styleUrls: ['./side-panel.scss']
})
export class SidePanelComponent implements OnInit, OnDestroy, OnChanges {
    @Input() item: Channel | Movie | Series | null = null;
    @Input() itemType: 'channel' | 'movie' | 'series' | null = null;
    @Output() close = new EventEmitter<void>();

    itemInfo: ChannelInfo | MovieInfo | SeriesInfo | null = null;
    loading = false;
    isFavorite = false;

    private destroy$ = new Subject<void>();

    constructor(
        private channelInfoService: ChannelInfoService,
        private favoritesService: FavoritesService,
        private epgService: EpgService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        // Carregar dados EPG na inicialização
        this.epgService.loadEPGData('brazil').subscribe();
        this.loadItemInfo();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['item'] && this.item) {
            this.loadItemInfo();
            this.checkIfFavorite();
        }
    }

    private loadItemInfo(): void {
        if (!this.item) {
            return;
        }

        this.loading = true;
        this.itemInfo = null;

        this.channelInfoService.getItemInfo(this.item).pipe(
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (info) => {
                    this.itemInfo = info;
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Erro ao carregar informações:', error);
                    this.loading = false;
                }
        });
    }

    private checkIfFavorite(): void {
        if (!this.item) return;
        
        const type = this.isChannel() ? 'channel' : this.isMovie() ? 'movie' : 'series';
        this.isFavorite = this.favoritesService.isFavorite(this.item.id, type);
    }

    toggleFavorite(): void {
        if (!this.item) {
            return;
        }

        const type = this.isChannel() ? 'channel' : this.isMovie() ? 'movie' : 'series';
        
        if (this.isFavorite) {
            this.favoritesService.removeFromFavorites(this.item.id, type);
        } else {
            this.favoritesService.addToFavorites(this.item, type);
        }
        
        this.isFavorite = !this.isFavorite;
    }

    isChannel(): boolean {
        return this.item ? this.item.item_type === 'channel' : false;
    }

    isMovie(): boolean {
        return this.item ? this.item.item_type === 'movie' : false;
    }

    isSeries(): boolean {
        return  this.item ? this.item.item_type === 'series' : false;
    }

    getChannelInfo(): ChannelInfo | null {
        return this.isChannel() ? this.itemInfo as ChannelInfo : null;
    }

    getMovieInfo(): MovieInfo | null {
        return this.isMovie() ? this.itemInfo as MovieInfo : null;
    }

    getSeriesInfo(): SeriesInfo | null {
        return this.isSeries() ? this.itemInfo as SeriesInfo : null;
    }

    formatTime(date: Date): string {
        return date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    formatRating(rating: number): string {
        return rating.toFixed(1);
    }

    formatDuration(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}min`;
        }

        return `${mins}min`;
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        img.src = '/assets/default.webp';
    }

    refreshEPG(): void {
        this.epgService.clearCache();

        this.epgService.loadEPGData('brazil').subscribe(() => {
            if (this.item) {
                this.loadItemInfo();
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }

    getItemLogo(): string | undefined {
        if (!this.item) {
            return undefined;
        }

        return (this.item as any).logo;
    }

    getItemName(): string {
        if (!this.item) {
            return '';
        }

        return (this.item as any).name || (this.item as any).title || '';
    }
}