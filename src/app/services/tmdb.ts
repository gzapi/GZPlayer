import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { map } from 'rxjs/operators';

import { Functions } from '../../functions';

export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    adult: boolean;
    original_language: string;
    original_title: string;
    popularity: number;
    video: boolean;
}

export interface TMDBTVShow {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    origin_country: string[];
    original_language: string;
    original_name: string;
    popularity: number;
}

export interface TMDBSearchResponse<T> {
    page: number;
    results: T[];
    total_pages: number;
    total_results: number;
}

export interface TMDBGenre {
    id: number;
    name: string;
}

export interface TMDBConfiguration {
    images: {
        base_url: string;
        secure_base_url: string;
        backdrop_sizes: string[];
        logo_sizes: string[];
        poster_sizes: string[];
        profile_sizes: string[];
        still_sizes: string[];
    };
}

@Injectable({
    providedIn: 'root'
})
export class TmdbService {
    private configuration: TMDBConfiguration | null = null;

    constructor(
        private http: HttpClient,
        public functions: Functions
    ) {
        this.loadConfiguration();
    }

    private loadConfiguration(): void {
        this.getConfiguration().subscribe(config => {
            this.configuration = config;
        });
    }

    private getConfiguration(): Observable<TMDBConfiguration> {
        const url = `${this.functions.BASE_URL}/configuration`;
        const params = new HttpParams().set('api_key', this.functions.API_KEY);
        
        return this.http.get<TMDBConfiguration>(url, { params }).pipe(
            catchError(error => {
                console.warn('Erro ao carregar configuração TMDB:', error);
                // Retornar configuração padrão
                return of({
                    images: {
                        base_url: 'http://image.tmdb.org/t/p/',
                        secure_base_url: 'https://image.tmdb.org/t/p/',
                        backdrop_sizes: ['w300', 'w780', 'w1280', 'original'],
                        logo_sizes: ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'],
                        poster_sizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
                        profile_sizes: ['w45', 'w185', 'h632', 'original'],
                        still_sizes: ['w92', 'w185', 'w300', 'original']
                    }
                });
            })
        );
  }

    searchMovies(query: string, page: number = 1): Observable<TMDBSearchResponse<TMDBMovie>> {
        const url = `${this.functions.BASE_URL}/search/movie`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('query', query)
            .set('page', page.toString())
            .set('language', 'pt-BR');

        return this.http.get<TMDBSearchResponse<TMDBMovie>>(url, { params }).pipe(
            catchError(error => {
                console.error('[TMDB] Erro completo:', error);

                return of({
                    page: 1,
                    results: [],
                    total_pages: 0,
                    total_results: 0
                });
            })
        );
    }

    searchTVShows(query: string, page: number = 1): Observable<TMDBSearchResponse<TMDBTVShow>> {
        const url = `${this.functions.BASE_URL}/search/tv`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('query', query)
            .set('page', page.toString())
            .set('language', 'pt-BR');
        
        return this.http.get<TMDBSearchResponse<TMDBTVShow>>(url, { params }).pipe(
            catchError(error => {
                console.error('Erro ao buscar séries:', error);
                return of({ page: 1, results: [], total_pages: 0, total_results: 0 });
            })
        );
    }

    getMovieDetails(id: number): Observable<TMDBMovie | null> {
        const url = `${this.functions.BASE_URL}/movie/${id}`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('language', 'pt-BR');
        
        return this.http.get<TMDBMovie>(url, { params }).pipe(
            catchError(error => {
                console.error('Erro ao buscar detalhes do filme:', error);
                return of(null);
            })
        );
    }

    getTVShowDetails(id: number): Observable<TMDBTVShow | null> {
        const url = `${this.functions.BASE_URL}/tv/${id}`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('language', 'pt-BR');
        
        return this.http.get<TMDBTVShow>(url, { params }).pipe(
            catchError(error => {
                console.error('Erro ao buscar detalhes da série:', error);
                return of(null);
            })
        );
    }

    getMovieGenres(): Observable<TMDBGenre[]> {
        const url = `${this.functions.BASE_URL}/genre/movie/list`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('language', 'pt-BR');

        return this.http.get<{ genres: TMDBGenre[] }>(url, { params }).pipe(
            map(response => response.genres),
            catchError(error => {
                console.error('Erro ao buscar gêneros de filmes:', error);
                return of([]);
            })
        );
    }

    getTVGenres(): Observable<TMDBGenre[]> {
        const url = `${this.functions.BASE_URL}/genre/tv/list`;
        const params = new HttpParams()
            .set('api_key', this.functions.API_KEY)
            .set('language', 'pt-BR');

        return this.http.get<{ genres: TMDBGenre[] }>(url, { params }).pipe(
            map(response => response.genres),
            catchError(error => {
                console.error('Erro ao buscar gêneros de séries:', error);
                return of([]);
            })
        );
    }

    getImageUrl(path: string | null, size: string = 'w500'): string {
        if (!path) {
            return 'https://via.placeholder.com/500x750?text=Sem+Poster';
        }
        
        const baseUrl = this.configuration?.images.secure_base_url || this.functions.IMAGE_BASE_URL;
        return `${baseUrl}${size}${path}`;
    }

    getBackdropUrl(path: string | null, size: string = 'w1280'): string {
        if (!path) {
            return 'https://via.placeholder.com/1280x720?text=Sem+Imagem';
        }
        
        const baseUrl = this.configuration?.images.secure_base_url || this.functions.IMAGE_BASE_URL;
        return `${baseUrl}${size}${path}`;
    }

  // Método para buscar informações baseado no título (usado pelo channel-info service)
    searchByTitle(title: string, type: 'movie' | 'tv' = 'movie'): Observable<TMDBMovie | TMDBTVShow | null> {
        if (type === 'movie') {
            return this.searchMovies(title).pipe(
                map(response => {
                if (response.results.length > 0) {
                    return response.results[0];
                }
                return null;
                })
            );
        } else {
            return this.searchTVShows(title).pipe(
                map(response => {
                if (response.results.length > 0) {
                    return response.results[0];
                }
                return null;
                })
            );
        }
    }

  // Método para enriquecer dados de filme/série com informações do TMDB
    enrichMovieData(title: string): Observable<any> {
        return this.searchByTitle(title, 'movie').pipe(
            map(movie => {
                if (!movie || !('title' in movie)) {
                    return null;
                }

                const movieData = movie as TMDBMovie;

                return {
                    title: movieData.title,
                    overview: movieData.overview,
                    poster: this.getImageUrl(movieData.poster_path),
                    backdrop: this.getBackdropUrl(movieData.backdrop_path),
                    releaseDate: movieData.release_date,
                    rating: movieData.vote_average,
                    voteCount: movieData.vote_count,
                    originalTitle: movieData.original_title,
                    language: movieData.original_language,
                    popularity: movieData.popularity
                };
            })
        );
    }

    enrichTVData(title: string): Observable<any> {
        return this.searchByTitle(title, 'tv').pipe(
            map(show => {
                if (!show || !('name' in show)) return null;
                
                const tvData = show as TMDBTVShow;
                return {
                title: tvData.name,
                overview: tvData.overview,
                poster: this.getImageUrl(tvData.poster_path),
                backdrop: this.getBackdropUrl(tvData.backdrop_path),
                firstAirDate: tvData.first_air_date,
                rating: tvData.vote_average,
                voteCount: tvData.vote_count,
                originalTitle: tvData.original_name,
                language: tvData.original_language,
                popularity: tvData.popularity,
                originCountry: tvData.origin_country
                };
            })
        );
    }

      // Método para detectar automaticamente se é filme ou série
    autoEnrichData(title: string): Observable<any> {
        // Primeiro tenta como filme
        return this.enrichMovieData(title).pipe(
            map(movieData => {
                if (movieData) {
                return { ...movieData, type: 'movie' };
                }
                return null;
            }),
            // Se não encontrar como filme, tenta como série
            catchError(() => {
                return this.enrichTVData(title).pipe(
                    map(tvData => {
                        if (tvData) {
                        return { ...tvData, type: 'tv' };
                        }
                        return null;
                    })
                );
            })
        );
    }
}