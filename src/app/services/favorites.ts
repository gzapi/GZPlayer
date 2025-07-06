import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FavoriteItem, Channel, Movie, Series } from '../models/interfaces';

@Injectable({
    providedIn: 'root'
})
export class FavoritesService {
    private readonly STORAGE_KEY = 'webplayer-favorites';
    private favoritesSubject = new BehaviorSubject<FavoriteItem[]>([]);
    public favorites$ = this.favoritesSubject.asObservable();

    constructor() {
        this.loadFavorites();
    }

    private loadFavorites(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);

            if (stored) {
                const favorites = JSON.parse(stored);
                this.favoritesSubject.next(favorites);
            }
        } catch (error) {
            console.error('Erro ao carregar favoritos:', error);
        }
    }

    private saveFavorites(favorites: FavoriteItem[]): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
            this.favoritesSubject.next(favorites);
        } catch (error) {
            console.error('Erro ao salvar favoritos:', error);
        }
    }

    addToFavorites(item: Channel | Movie | Series, type: 'channel' | 'movie' | 'series'): void {
        const currentFavorites = this.favoritesSubject.value;
        const exists = currentFavorites.find(fav => fav.id === item.id && fav.type === type);

        if (!exists) {
            const favoriteItem: FavoriteItem = {
                id: item.id,
                type: type,
                data: { 
                    ...item, 
                    isFavorite: true 
                }
            };

            const updatedFavorites = [...currentFavorites, favoriteItem];
            this.saveFavorites(updatedFavorites);
        }
    }

    removeFromFavorites(id: string, type: 'channel' | 'movie' | 'series'): void {
        const currentFavorites = this.favoritesSubject.value;
        const updatedFavorites = currentFavorites.filter(
            fav => !(fav.id === id && fav.type === type)
        );
        this.saveFavorites(updatedFavorites);
    }

    isFavorite(id: string, type: 'channel' | 'movie' | 'series'): boolean {
        const currentFavorites = this.favoritesSubject.value;
        return currentFavorites.some(fav => fav.id === id && fav.type === type);
    }

    toggleFavorite(item: Channel | Movie | Series, type: 'channel' | 'movie' | 'series'): void {
        if (this.isFavorite(item.id, type)) {
            this.removeFromFavorites(item.id, type);
        } else {
            this.addToFavorites(item, type);
        }
    }

    getFavoritesByType(type: 'channel' | 'movie' | 'series'): FavoriteItem[] {
        return this.favoritesSubject.value.filter(fav => fav.type === type);
    }

    getAllFavorites(): FavoriteItem[] {
        return this.favoritesSubject.value;
    }

    clearAllFavorites(): void {
        this.saveFavorites([]);
    }

    getFavoritesCount(): number {
        return this.favoritesSubject.value.length;
    }

    getFavoritesCountByType(type: 'channel' | 'movie' | 'series'): number {
        return this.favoritesSubject.value.filter(fav => fav.type === type).length;
    }
}

