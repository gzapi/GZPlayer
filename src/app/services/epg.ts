import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface EPGProgram {
  id: string;
  title: string;
  description?: string;
  start: Date;
  stop: Date;
  category?: string;
  episode?: string;
  season?: string;
  year?: number;
  rating?: string;
  director?: string;
  actors?: string[];
  country?: string;
  language?: string;
}

export interface EPGChannel {
  id: string;
  displayName: string;
  icon?: string;
  url?: string;
  programs: EPGProgram[];
}

export interface EPGData {
  channels: EPGChannel[];
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EpgService {
  private readonly EPG_SOURCES = {
    global: 'https://epg.pw/xmltv/epg_lite.xml',
    brazil: 'https://epg.pw/xmltv/epg_BR.xml',
    australia: 'https://epg.pw/xmltv/epg_AU.xml'
  };

  private epgDataSubject = new BehaviorSubject<EPGData | null>(null);
  public epgData$ = this.epgDataSubject.asObservable();

  private cache = new Map<string, { data: EPGData; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

  constructor(private http: HttpClient) {}

  loadEPGData(source: 'global' | 'brazil' | 'australia' = 'global'): Observable<EPGData> {
    const cacheKey = source;
    const cached = this.cache.get(cacheKey);
    
    // Verificar cache
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      this.epgDataSubject.next(cached.data);
      return of(cached.data);
    }

    const url = this.EPG_SOURCES[source];
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      map(xmlData => this.parseXMLTV(xmlData)),
      tap(epgData => {
        // Atualizar cache
        this.cache.set(cacheKey, {
          data: epgData,
          timestamp: Date.now()
        });
        
        this.epgDataSubject.next(epgData);
      }),
      catchError(error => {
        console.error('Erro ao carregar EPG:', error);
        
        // Retornar dados mock em caso de erro
        const mockData = this.generateMockEPGData();
        this.epgDataSubject.next(mockData);
        return of(mockData);
      })
    );
  }

  private parseXMLTV(xmlData: string): EPGData {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      const channels: EPGChannel[] = [];
      const channelElements = xmlDoc.querySelectorAll('channel');
      
      // Parse channels
      channelElements.forEach(channelEl => {
        const id = channelEl.getAttribute('id') || '';
        const displayNameEl = channelEl.querySelector('display-name');
        const iconEl = channelEl.querySelector('icon');
        
        const channel: EPGChannel = {
          id,
          displayName: displayNameEl?.textContent || id,
          icon: iconEl?.getAttribute('src') || undefined,
          programs: []
        };
        
        channels.push(channel);
      });

      // Parse programs
      const programElements = xmlDoc.querySelectorAll('programme');
      
      programElements.forEach(programEl => {
        const channelId = programEl.getAttribute('channel') || '';
        const start = this.parseXMLTVTime(programEl.getAttribute('start') || '');
        const stop = this.parseXMLTVTime(programEl.getAttribute('stop') || '');
        
        const titleEl = programEl.querySelector('title');
        const descEl = programEl.querySelector('desc');
        const categoryEl = programEl.querySelector('category');
        const episodeEl = programEl.querySelector('episode-num');
        
        const program: EPGProgram = {
          id: `${channelId}_${start.getTime()}`,
          title: titleEl?.textContent || 'Programa sem título',
          description: descEl?.textContent || undefined,
          start,
          stop,
          category: categoryEl?.textContent || undefined,
          episode: episodeEl?.textContent || undefined
        };

        // Encontrar canal e adicionar programa
        const channel = channels.find(ch => ch.id === channelId);
        if (channel) {
          channel.programs.push(program);
        }
      });

      // Ordenar programas por horário
      channels.forEach(channel => {
        channel.programs.sort((a, b) => a.start.getTime() - b.start.getTime());
      });

      return {
        channels,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Erro ao fazer parse do XMLTV:', error);
      return this.generateMockEPGData();
    }
  }

  private parseXMLTVTime(timeStr: string): Date {
    // Formato XMLTV: YYYYMMDDHHMMSS +ZZZZ
    if (!timeStr || timeStr.length < 14) {
      return new Date();
    }
    
    const year = parseInt(timeStr.substr(0, 4));
    const month = parseInt(timeStr.substr(4, 2)) - 1; // Mês é 0-based
    const day = parseInt(timeStr.substr(6, 2));
    const hour = parseInt(timeStr.substr(8, 2));
    const minute = parseInt(timeStr.substr(10, 2));
    const second = parseInt(timeStr.substr(12, 2));
    
    return new Date(year, month, day, hour, minute, second);
  }

  private generateMockEPGData(): EPGData {
    const now = new Date();
    const channels: EPGChannel[] = [];

    // Gerar alguns canais mock
    const mockChannels = [
      { id: 'globo', name: 'TV Globo', icon: 'https://via.placeholder.com/100x50?text=Globo' },
      { id: 'sbt', name: 'SBT', icon: 'https://via.placeholder.com/100x50?text=SBT' },
      { id: 'record', name: 'Record TV', icon: 'https://via.placeholder.com/100x50?text=Record' },
      { id: 'band', name: 'Band', icon: 'https://via.placeholder.com/100x50?text=Band' },
      { id: 'redetv', name: 'RedeTV!', icon: 'https://via.placeholder.com/100x50?text=RedeTV' }
    ];

    const mockPrograms = [
      'Jornal Nacional', 'Novela das 8', 'Fantástico', 'Caldeirão',
      'Programa do Ratinho', 'Casos de Família', 'Fofocalizando',
      'Cidade Alerta', 'Balanço Geral', 'Domingo Espetacular',
      'CQC', 'Pânico na Band', 'Os Donos da Bola', 'Jogo Aberto'
    ];

    mockChannels.forEach(mockChannel => {
      const programs: EPGProgram[] = [];
      
      // Gerar programação para as próximas 12 horas
      for (let i = 0; i < 12; i++) {
        const startTime = new Date(now.getTime() + (i * 60 * 60 * 1000)); // Cada hora
        const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hora de duração
        
        const program: EPGProgram = {
          id: `${mockChannel.id}_${startTime.getTime()}`,
          title: mockPrograms[Math.floor(Math.random() * mockPrograms.length)],
          description: 'Programa de entretenimento com conteúdo variado.',
          start: startTime,
          stop: endTime,
          category: i < 6 ? 'Entretenimento' : 'Jornalismo'
        };
        
        programs.push(program);
      }

      channels.push({
        id: mockChannel.id,
        displayName: mockChannel.name,
        icon: mockChannel.icon,
        programs
      });
    });

    return {
      channels,
      lastUpdated: now
    };
  }

  getCurrentProgram(channelId: string): Observable<EPGProgram | null> {
    return this.epgData$.pipe(
      map(epgData => {
        if (!epgData) return null;
        
        const channel = epgData.channels.find(ch => ch.id === channelId);
        if (!channel) return null;
        
        const now = new Date();
        const currentProgram = channel.programs.find(program => 
          program.start <= now && program.stop > now
        );
        
        return currentProgram || null;
      })
    );
  }

  getNextProgram(channelId: string): Observable<EPGProgram | null> {
    return this.epgData$.pipe(
      map(epgData => {
        if (!epgData) return null;
        
        const channel = epgData.channels.find(ch => ch.id === channelId);
        if (!channel) return null;
        
        const now = new Date();
        const nextProgram = channel.programs.find(program => 
          program.start > now
        );
        
        return nextProgram || null;
      })
    );
  }

  getChannelSchedule(channelId: string, date?: Date): Observable<EPGProgram[]> {
    return this.epgData$.pipe(
      map(epgData => {
        if (!epgData) return [];
        
        const channel = epgData.channels.find(ch => ch.id === channelId);
        if (!channel) return [];
        
        if (!date) {
          return channel.programs;
        }
        
        // Filtrar programas do dia específico
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return channel.programs.filter(program => 
          program.start >= startOfDay && program.start <= endOfDay
        );
      })
    );
  }

  searchPrograms(query: string): Observable<EPGProgram[]> {
    return this.epgData$.pipe(
      map(epgData => {
        if (!epgData) return [];
        
        const allPrograms: EPGProgram[] = [];
        epgData.channels.forEach(channel => {
          allPrograms.push(...channel.programs);
        });
        
        const searchTerm = query.toLowerCase();
        return allPrograms.filter(program => 
          program.title.toLowerCase().includes(searchTerm) ||
          (program.description && program.description.toLowerCase().includes(searchTerm))
        );
      })
    );
  }

  // Método para mapear canal M3U para canal EPG
  mapChannelToEPG(channelName: string): string {
    // Mapeamento simples baseado no nome
    const mappings: { [key: string]: string } = {
      'globo': 'globo',
      'tv globo': 'globo',
      'rede globo': 'globo',
      'sbt': 'sbt',
      'sistema brasileiro de televisão': 'sbt',
      'record': 'record',
      'record tv': 'record',
      'rede record': 'record',
      'band': 'band',
      'bandeirantes': 'band',
      'rede bandeirantes': 'band',
      'redetv': 'redetv',
      'rede tv': 'redetv'
    };
    
    const normalizedName = channelName.toLowerCase().trim();
    
    // Busca exata
    if (mappings[normalizedName]) {
      return mappings[normalizedName];
    }
    
    // Busca por palavras-chave
    for (const [key, value] of Object.entries(mappings)) {
      if (normalizedName.includes(key)) {
        return value;
      }
    }
    
    // Se não encontrar, retorna o nome original normalizado
    return normalizedName.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  clearCache(): void {
    this.cache.clear();
  }
}

