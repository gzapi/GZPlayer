import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { Channel, Movie, Series, M3UPlaylist } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class M3uParserService {

  constructor(private http: HttpClient) { }

  parseM3UFromUrl(url: string): Observable<M3UPlaylist> {
    // Configurar headers para evitar problemas de CORS
    const headers = new HttpHeaders({
      'Accept': 'text/plain, application/x-mpegURL, application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache'
    });

    return this.http.get(url, { 
      responseType: 'text',
      headers: headers
    }).pipe(
      map(content => {
        console.log('M3U content received:', content.substring(0, 200) + '...');
        return this.parseM3UContent(content);
      }),
      catchError(this.handleError)
    );
  }

  parseM3UFromFile(file: File): Observable<M3UPlaylist> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const playlist = this.parseM3UContent(content);
          observer.next(playlist);
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      };
      
      reader.onerror = () => {
        observer.error(new Error('Erro ao ler o arquivo'));
      };
      
      reader.readAsText(file);
    });
  }

  parseM3UContent(content: string): M3UPlaylist {
    if (!content || !content.trim()) {
      throw new Error('Conteúdo M3U vazio');
    }

    // Validar se é um arquivo M3U válido
    if (!this.validateM3U(content)) {
      throw new Error('Formato M3U inválido. O arquivo deve começar com #EXTM3U');
    }

    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const channels: Channel[] = [];
    const movies: Movie[] = [];
    const series: Series[] = [];

    let currentInfo: any = {};
    let processedItems = 0;
    
    console.log('Parsing M3U with', lines.length, 'lines');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#EXTINF:')) {
        currentInfo = this.parseExtinf(line);
      } else if (this.isValidUrl(line)) {
        const item = {
          id: this.generateId(),
          name: currentInfo.title || 'Item sem nome',
          url: line,
          logo: currentInfo.tvgLogo || currentInfo.logo || '',
          group: currentInfo.groupTitle || 'Sem categoria',
          tvgId: currentInfo.tvgId || '',
          tvgName: currentInfo.tvgName || '',
          tvgLogo: currentInfo.tvgLogo || '',
          groupTitle: currentInfo.groupTitle || '',
          isFavorite: false
        };

        // Classificar por tipo baseado no grupo ou nome
        if (this.isMovie(item)) {
          movies.push({
            id: item.id,
            title: item.name,
            url: item.url,
            poster: item.logo,
            genre: item.group,
            year: this.extractYear(item.name),
            isFavorite: false
          });
        } else if (this.isSeries(item)) {
          series.push({
            id: item.id,
            title: item.name,
            url: item.url,
            poster: item.logo,
            genre: item.group,
            seasons: this.extractSeasons(item.name),
            isFavorite: false
          });
        } else {
          channels.push(item);
        }
        
        processedItems++;
        currentInfo = {};
      }
    }

    console.log('M3U parsing completed:', {
      channels: channels.length,
      movies: movies.length,
      series: series.length,
      total: processedItems
    });

    if (processedItems === 0) {
      throw new Error('Nenhum item válido encontrado no arquivo M3U');
    }

    return { channels, movies, series };
  }

  private validateM3U(content: string): boolean {
    const trimmedContent = content.trim();
    return trimmedContent.startsWith('#EXTM3U') || 
           trimmedContent.includes('#EXTINF:') ||
           trimmedContent.includes('http');
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }

  private parseExtinf(line: string): any {
    const info: any = {};
    
    // Extrair título (última parte após vírgula)
    const titleMatch = line.match(/,(.*)$/);
    if (titleMatch) {
      info.title = titleMatch[1].trim();
    }

    // Extrair atributos usando regex mais robusta
    const attributeRegex = /(\w+(?:-\w+)*)="([^"]*)"/g;
    let match;
    
    while ((match = attributeRegex.exec(line)) !== null) {
      const key = match[1].toLowerCase().replace('-', '');
      const value = match[2];
      
      switch (key) {
        case 'tvgid':
          info.tvgId = value;
          break;
        case 'tvgname':
          info.tvgName = value;
          break;
        case 'tvglogo':
          info.tvgLogo = value;
          break;
        case 'grouptitle':
          info.groupTitle = value;
          break;
        case 'logo':
          info.logo = value;
          break;
      }
    }

    return info;
  }

  private isMovie(item: any): boolean {
    const movieKeywords = ['filme', 'movie', 'cinema', 'filmes', 'movies', 'film'];
    const group = (item.group || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    
    return movieKeywords.some(keyword => 
      group.includes(keyword) || name.includes(keyword)
    );
  }

  private isSeries(item: any): boolean {
    const seriesKeywords = ['serie', 'series', 'tv show', 'temporada', 'season', 'séries', 'seriado'];
    const group = (item.group || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    
    return seriesKeywords.some(keyword => 
      group.includes(keyword) || name.includes(keyword)
    );
  }

  private extractYear(title: string): number | undefined {
    const yearMatch = title.match(/\((\d{4})\)|\[(\d{4})\]|(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3]);
      if (year >= 1900 && year <= new Date().getFullYear() + 5) {
        return year;
      }
    }
    return undefined;
  }

  private extractSeasons(title: string): number | undefined {
    const seasonMatch = title.match(/temporada\s*(\d+)|season\s*(\d+)|s(\d+)/i);
    if (seasonMatch) {
      return parseInt(seasonMatch[1] || seasonMatch[2] || seasonMatch[3]);
    }
    return undefined;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Erro desconhecido ao carregar M3U';
    
    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro de rede: ${error.error.message}`;
    } else {
      // Erro do lado do servidor
      switch (error.status) {
        case 0:
          errorMessage = 'Erro de CORS ou conexão. Verifique se a URL permite acesso externo.';
          break;
        case 404:
          errorMessage = 'Arquivo M3U não encontrado (404).';
          break;
        case 403:
          errorMessage = 'Acesso negado ao arquivo M3U (403).';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor (500).';
          break;
        default:
          errorMessage = `Erro HTTP ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erro detalhado:', error);
    return throwError(() => new Error(errorMessage));
  }
}

