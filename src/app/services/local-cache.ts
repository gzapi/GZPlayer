import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

interface CachedLogo {
    url: string;
    blob: Blob;
    dataUrl: string;
    timestamp: number;
    size: number;
    lastAccessed: number;
}

interface CacheStats {
    totalItems: number;
    totalSize: number;
    hits: number;
    misses: number;
    hitRate: number;
}

@Injectable({
    providedIn: 'root'
})
export class LogoCacheService {
    private readonly CACHE_NAME = 'channel-logos-cache';
    private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
    private readonly MAX_CACHE_ITEMS = 1000;
    private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 dias
    private readonly SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    private cache = new Map<string, CachedLogo>();
    private cacheStats = {
        totalItems: 0,
        totalSize: 0,
        hits: 0,
        misses: 0,
        hitRate: 0
    };

    private loadingPromises = new Map<string, Promise<string>>();
    private cacheReady$ = new BehaviorSubject<boolean>(false);

    constructor() {
        this.initializeCache();
    }

    /**
     * Inicializar cache do IndexedDB
     */
    private async initializeCache(): Promise<void> {
        try {
            if ('caches' in window) {
                const cache = await caches.open(this.CACHE_NAME);
                const requests = await cache.keys();

                let totalSize = 0;
                let loadedCount = 0;

                for (const request of requests) {
                    try {
                        const response = await cache.match(request);
                        if (response) {
                            const blob = await response.blob();
                            const timestamp = parseInt(response.headers.get('x-cache-timestamp') || '0');
                            const lastAccessed = parseInt(response.headers.get('x-last-accessed') || '0');
                            
                            // Verificar se não expirou
                            if (Date.now() - timestamp < this.CACHE_EXPIRY) {
                                const dataUrl = await this.blobToDataUrl(blob);
                                
                                this.cache.set(request.url, {
                                    url: request.url,
                                    blob,
                                    dataUrl,
                                    timestamp,
                                    size: blob.size,
                                    lastAccessed: lastAccessed || timestamp
                                });

                                totalSize += blob.size;
                                loadedCount++;
                            } else {
                                // Remover itens expirados
                                await cache.delete(request);
                            }
                        }
                    } catch (error) {
                        console.warn(`Erro ao carregar logo do cache: ${request.url}`, error);
                        // Remove entrada problemática
                        await cache.delete(request);
                    }
                }

                this.cacheStats.totalItems = loadedCount;
                this.cacheStats.totalSize = totalSize;
                
                console.log(`Cache de logos inicializado: ${loadedCount} itens, ${this.formatBytes(totalSize)}`);
            }
        } catch (error) {
            console.error('Erro ao inicializar cache de logos:', error);
        } finally {
            this.cacheReady$.next(true);
        }
    }

    /**
     * Obter logo com cache
     */
    getLogo(url: string): Observable<string> {
        if (!url || !this.isValidUrl(url)) {
            return of('');
        }

        // Verificar se está em cache
        const cached = this.cache.get(url);
        if (cached) {
            // Atualizar último acesso
            cached.lastAccessed = Date.now();
            this.cacheStats.hits++;
            this.updateHitRate();
            
            return of(cached.dataUrl);
        }

        // Verificar se já está sendo baixado
        if (this.loadingPromises.has(url)) {
            return from(this.loadingPromises.get(url)!);
        }

        // Baixar e cachear
        this.cacheStats.misses++;
        this.updateHitRate();

        const loadingPromise = this.downloadAndCache(url);
        this.loadingPromises.set(url, loadingPromise);

        return from(loadingPromise).pipe(
            tap(() => this.loadingPromises.delete(url)),
            catchError((error) => {
                console.warn(`Erro ao carregar logo: ${url}`, error);
                this.loadingPromises.delete(url);
                return of('');
            })
        );
    }

    /**
     * Baixar e cachear logo
     */
    private async downloadAndCache(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                cache: 'default'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!this.SUPPORTED_FORMATS.some(format => contentType.includes(format.split('/')[1]))) {
                throw new Error(`Formato não suportado: ${contentType}`);
            }

            const blob = await response.blob();
            
            // Verificar tamanho (máximo 5MB por imagem)
            if (blob.size > 5 * 1024 * 1024) {
                throw new Error(`Imagem muito grande: ${this.formatBytes(blob.size)}`);
            }

            const dataUrl = await this.blobToDataUrl(blob);
            const timestamp = Date.now();

            // Verificar espaço disponível
            await this.ensureSpace(blob.size);

            // Salvar em cache
            const cachedLogo: CachedLogo = {
                url,
                blob,
                dataUrl,
                timestamp,
                size: blob.size,
                lastAccessed: timestamp
            };

            this.cache.set(url, cachedLogo);
            this.cacheStats.totalItems++;
            this.cacheStats.totalSize += blob.size;

            // Salvar no Cache API
            if ('caches' in window) {
                const cache = await caches.open(this.CACHE_NAME);
                const responseToCache = new Response(blob, {
                    headers: {
                        'content-type': contentType,
                        'x-cache-timestamp': timestamp.toString(),
                        'x-last-accessed': timestamp.toString()
                    }
                });
                await cache.put(url, responseToCache);
            }

            return dataUrl;

        } catch (error) {
            console.error(`Erro ao baixar logo ${url}:`, error);
            throw error;
        }
    }

    /**
     * Garantir espaço suficiente no cache
     */
    private async ensureSpace(requiredSize: number): Promise<void> {
        // Verificar se precisa limpar cache
        while (
            (this.cacheStats.totalSize + requiredSize > this.MAX_CACHE_SIZE) ||
            (this.cacheStats.totalItems >= this.MAX_CACHE_ITEMS)
        ) {
            await this.removeOldestItem();
        }
    }

    /**
     * Remover item mais antigo do cache
     */
    private async removeOldestItem(): Promise<void> {
        let oldestUrl = '';
        let oldestTime = Date.now();

        // Encontrar item mais antigo (baseado no último acesso)
        for (const [url, cached] of this.cache.entries()) {
            if (cached.lastAccessed < oldestTime) {
                oldestTime = cached.lastAccessed;
                oldestUrl = url;
            }
        }

        if (oldestUrl) {
            await this.removeFromCache(oldestUrl);
        }
    }

    /**
     * Remover item específico do cache
     */
    private async removeFromCache(url: string): Promise<void> {
        const cached = this.cache.get(url);
        if (cached) {
            this.cache.delete(url);
            this.cacheStats.totalItems--;
            this.cacheStats.totalSize -= cached.size;

            // Remover do Cache API
            if ('caches' in window) {
                try {
                    const cache = await caches.open(this.CACHE_NAME);
                    await cache.delete(url);
                } catch (error) {
                    console.warn(`Erro ao remover ${url} do Cache API:`, error);
                }
            }
        }
    }

    /**
     * Pré-carregar logos em lote
     */
    async preloadLogos(urls: string[], maxConcurrent: number = 5): Promise<void> {
        if (!urls.length) return;

        console.log(`Pré-carregando ${urls.length} logos...`);
        const startTime = Date.now();

        // Filtrar URLs já em cache
        const urlsToLoad = urls.filter(url => 
            this.isValidUrl(url) && !this.cache.has(url) && !this.loadingPromises.has(url)
        );

        if (!urlsToLoad.length) {
            console.log('Todos os logos já estão em cache');
            return;
        }

        // Processar em lotes para não sobrecarregar
        for (let i = 0; i < urlsToLoad.length; i += maxConcurrent) {
            const batch = urlsToLoad.slice(i, i + maxConcurrent);
            
            await Promise.allSettled(
                batch.map(url => this.downloadAndCache(url).catch(error => 
                    console.warn(`Falha ao pré-carregar ${url}:`, error)
                ))
            );

            // Pequena pausa entre lotes
            if (i + maxConcurrent < urlsToLoad.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const duration = Date.now() - startTime;
        console.log(`Pré-carregamento concluído em ${duration}ms`);
    }

    /**
     * Limpar cache expirado
     */
    async cleanExpiredCache(): Promise<number> {
        const expiredUrls: string[] = [];
        const now = Date.now();

        for (const [url, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.CACHE_EXPIRY) {
                expiredUrls.push(url);
            }
        }

        for (const url of expiredUrls) {
            await this.removeFromCache(url);
        }

        if (expiredUrls.length > 0) {
            console.log(`Removidos ${expiredUrls.length} logos expirados do cache`);
        }

        return expiredUrls.length;
    }

    /**
     * Limpar todo o cache
     */
    async clearCache(): Promise<void> {
        try {
            this.cache.clear();
            this.loadingPromises.clear();
            
            if ('caches' in window) {
                await caches.delete(this.CACHE_NAME);
            }

            this.cacheStats = {
                totalItems: 0,
                totalSize: 0,
                hits: 0,
                misses: 0,
                hitRate: 0
            };

            console.log('Cache de logos limpo completamente');
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
        }
    }

    /**
     * Obter estatísticas do cache
     */
    getCacheStats(): CacheStats {
        return { ...this.cacheStats };
    }

    /**
     * Verificar se cache está pronto
     */
    isCacheReady(): Observable<boolean> {
        return this.cacheReady$.asObservable();
    }

    /**
     * Utilitários privados
     */
    private isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    private async blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    private updateHitRate(): void {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        this.cacheStats.hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Exportar configurações de cache
     */
    getCacheInfo(): any {
        return {
            maxSize: this.formatBytes(this.MAX_CACHE_SIZE),
            maxItems: this.MAX_CACHE_ITEMS,
            expiryDays: this.CACHE_EXPIRY / (24 * 60 * 60 * 1000),
            supportedFormats: this.SUPPORTED_FORMATS,
            stats: this.getCacheStats(),
            currentSize: this.formatBytes(this.cacheStats.totalSize)
        };
    }
}