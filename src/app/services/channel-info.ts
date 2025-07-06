import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, combineLatest } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { TmdbService } from './tmdb';
import { EpgService, EPGProgram } from './epg';
import { Channel, Movie, Series } from '../models/interfaces';

export interface ChannelInfo {
    id: string;
    name: string;
    tvg_logo?: string;
    currentProgram?: EPGProgram;
    nextProgram?: EPGProgram;
    schedule?: EPGProgram[];
    epgChannelId?: string;
}

export interface MovieInfo {
    title: string;
    overview?: string;
    tvg_logo?: string;
    backdrop?: string;
    releaseDate?: string;
    rating?: number;
    voteCount?: number;
    originalTitle?: string;
    language?: string;
    popularity?: number;
    genres?: string[];
    director?: string;
    cast?: string[];
    runtime?: number;
    budget?: number;
    revenue?: number;
}

export interface SeriesInfo {
    title: string;
    overview?: string;
    tvg_logo?: string;
    backdrop?: string;
    firstAirDate?: string;
    rating?: number;
    voteCount?: number;
    originalTitle?: string;
    language?: string;
    popularity?: number;
    genres?: string[];
    creator?: string;
    cast?: string[];
    numberOfSeasons?: number;
    numberOfEpisodes?: number;
    status?: string;
    networks?: string[];
    originCountry?: string[];
}

@Injectable({
    providedIn: 'root'
})
export class ChannelInfoService {
    constructor(
        private http: HttpClient,
        private tmdbService: TmdbService,
        private epgService: EpgService
    ) {}

    getChannelInfo(channel: Channel): Observable<ChannelInfo> {
        const epgChannelId = this.epgService.mapChannelToEPG(channel.title);
        
        return combineLatest([
            this.epgService.getCurrentProgram(epgChannelId),
            this.epgService.getNextProgram(epgChannelId),
            this.epgService.getChannelSchedule(epgChannelId)
        ]).pipe(
            map(([currentProgram, nextProgram, schedule]) => ({
                id: channel.id,
                name: channel.title,
                logo: channel.tvg_logo,
                currentProgram: currentProgram || undefined,
                nextProgram: nextProgram || undefined,
                schedule: schedule.slice(0, 10), // Próximos 10 programas
                epgChannelId
            })),
            catchError(error => {
                console.error('Erro ao buscar informações do canal:', error);
                return of({
                    id: channel.id,
                    name: channel.title,
                    logo: channel.tvg_logo,
                    currentProgram: this.generateMockProgram('Programa Atual'),
                    nextProgram: this.generateMockProgram('Próximo Programa'),
                    schedule: [
                        this.generateMockProgram('Programa 1'),
                        this.generateMockProgram('Programa 2'),
                        this.generateMockProgram('Programa 3')
                    ],

                    epgChannelId
                });
            })
        );
    }

    getMovieInfo(movie: Movie): Observable<MovieInfo> {
        return this.tmdbService.enrichMovieData(movie.title).pipe(
            map(tmdbData => {
                if (!tmdbData) {
                return this.generateMockMovieInfo(movie);
                }
                
                return {
                    title: tmdbData.title,
                    overview: tmdbData.overview,
                    poster: tmdbData.poster,
                    backdrop: tmdbData.backdrop,
                    releaseDate: tmdbData.releaseDate,
                    rating: tmdbData.rating,
                    voteCount: tmdbData.voteCount,
                    originalTitle: tmdbData.originalTitle,
                    language: tmdbData.language,
                    popularity: tmdbData.popularity,
                    genres: movie.genre ? [movie.genre] : [],
                    runtime: typeof movie.duration === 'number' ? movie.duration : undefined
                };
            }),
            catchError(error => {
                console.error('Erro ao buscar informações do filme:', error);
                return of(this.generateMockMovieInfo(movie));
            })
        );
    }

    getSeriesInfo(series: Series): Observable<SeriesInfo> {
        return this.tmdbService.enrichTVData(series.title).pipe(
            map(tmdbData => {
                if (!tmdbData) {
                return this.generateMockSeriesInfo(series);
                }
                
                return {
                title: tmdbData.title,
                overview: tmdbData.overview,
                poster: tmdbData.poster,
                backdrop: tmdbData.backdrop,
                firstAirDate: tmdbData.firstAirDate,
                rating: tmdbData.rating,
                voteCount: tmdbData.voteCount,
                originalTitle: tmdbData.originalTitle,
                language: tmdbData.language,
                popularity: tmdbData.popularity,
                genres: series.genre ? [series.genre] : [],
                numberOfSeasons: series.seasons,
                originCountry: tmdbData.originCountry
                };
            }),
            catchError(error => {
                console.error('Erro ao buscar informações da série:', error);
                return of(this.generateMockSeriesInfo(series));
            })
        );
    }

    // Método genérico para buscar informações baseado no tipo
    getItemInfo(item: Channel | Movie | Series): Observable<ChannelInfo | MovieInfo | SeriesInfo> {
        if ('url' in item && item.url.includes('m3u8')) {
            // É um canal
            return this.getChannelInfo(item as Channel);
        } else if ('duration' in item) {
            // É um filme
            return this.getMovieInfo(item as Movie);
        } else if ('seasons' in item) {
            // É uma série
            return this.getSeriesInfo(item as Series);
        } else {
            // Fallback para canal
            return this.getChannelInfo(item as Channel);
        }
    }

    private generateMockProgram(title: string): EPGProgram {
        const now = new Date();
        return {
            id: `mock_${Date.now()}`,
            title,
            description: 'Programa de entretenimento com conteúdo variado.',
            start: now,
            stop: new Date(now.getTime() + 60 * 60 * 1000), // 1 hora
            category: 'Entretenimento'
        };
    }

    private generateMockMovieInfo(movie: Movie): MovieInfo {
        return {
            title: movie.title,
            overview: 'Filme emocionante com uma história cativante que prende a atenção do público do início ao fim.',
            tvg_logo: movie.tvg_logo || '/assets/default.webp',
            backdrop: 'https://via.placeholder.com/1280x720?text=' + encodeURIComponent(movie.title),
            releaseDate: '',
            rating: 0,
            voteCount: 0,
            originalTitle: movie.title,
            language: '',
            popularity: 0.0,
            genres: movie.genre ? [movie.genre] : ['Drama'],
            runtime: typeof movie.duration === 'number' ? movie.duration : 120
        };
    }

    private generateMockSeriesInfo(series: Series): SeriesInfo {
        return {
            title: series.title,
            overview: 'Série envolvente com personagens complexos e uma narrativa que evolui ao longo das temporadas.',
            tvg_logo: 'https://via.placeholder.com/500x750?text=' + encodeURIComponent(series.title),
            backdrop: 'https://via.placeholder.com/1280x720?text=' + encodeURIComponent(series.title),
            firstAirDate: '2023-01-01',
            rating: 8.2,
            voteCount: 2500,
            originalTitle: series.title,
            language: 'pt',
            popularity: 92.3,
            genres: series.genre ? [series.genre] : ['Drama'],
            numberOfSeasons: series.seasons || 1,
            numberOfEpisodes: (series.seasons || 1) * 10,
            status: 'Em exibição',
            networks: ['Netflix', 'Amazon Prime'],
            originCountry: ['BR']
        };
    }

    // Método para buscar programação de canal específico
    getChannelSchedule(channelId: string, date?: Date): Observable<EPGProgram[]> {
        const epgChannelId = this.epgService.mapChannelToEPG(channelId);
        return this.epgService.getChannelSchedule(epgChannelId, date);
    }

    // Método para buscar programa atual
    getCurrentProgram(channelId: string): Observable<EPGProgram | null> {
        const epgChannelId = this.epgService.mapChannelToEPG(channelId);
        return this.epgService.getCurrentProgram(epgChannelId);
    }

    // Método para buscar próximo programa
    getNextProgram(channelId: string): Observable<EPGProgram | null> {
        const epgChannelId = this.epgService.mapChannelToEPG(channelId);
        return this.epgService.getNextProgram(epgChannelId);
    }

    // Método para buscar programas por termo
    searchPrograms(query: string): Observable<EPGProgram[]> {
        return this.epgService.searchPrograms(query);
    }
}