# Sugestões e Melhorias para o WebPlayer Angular

## 🎯 Respostas às suas dúvidas

### Como capturar o programa atual dos canais?

Para capturar informações de programação em tempo real, você pode usar:

#### 1. APIs de EPG (Electronic Program Guide)
```typescript
// Exemplo de integração com API de EPG
async getCurrentProgram(channelId: string): Promise<ProgramInfo> {
  const response = await fetch(`https://api.epg.com/current/${channelId}`);
  return response.json();
}
```

#### 2. Web Scraping de sites de programação
```typescript
// Exemplo usando um proxy para evitar CORS
async scrapeProgram(channelName: string): Promise<ProgramInfo> {
  const proxyUrl = `https://api.allorigins.win/get?url=`;
  const targetUrl = `https://programacao.tv/${channelName}`;
  // Implementar parsing do HTML retornado
}
```

#### 3. APIs específicas por região
- **Brasil**: API da Globo, SBT, etc.
- **Portugal**: RTP, TVI, SIC
- **Internacional**: TV Guide API, EPG APIs

### Como obter informações de filmes e séries?

#### 1. TMDB (The Movie Database) - Recomendado
```typescript
// Configuração da API TMDB
const TMDB_API_KEY = 'sua_chave_aqui';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async getMovieInfo(title: string): Promise<MovieInfo> {
  const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${title}&language=pt-BR`;
  const response = await fetch(searchUrl);
  const data = await response.json();
  return data.results[0]; // Primeiro resultado
}
```

#### 2. OMDB API
```typescript
async getMovieFromOMDB(title: string): Promise<MovieInfo> {
  const url = `http://www.omdbapi.com/?t=${title}&apikey=sua_chave`;
  const response = await fetch(url);
  return response.json();
}
```

## 🚀 Melhorias Sugeridas

### 1. Sistema de Cache
```typescript
@Injectable()
export class CacheService {
  private cache = new Map<string, any>();
  
  get(key: string): any {
    return this.cache.get(key);
  }
  
  set(key: string, value: any, ttl: number = 3600000): void {
    this.cache.set(key, value);
    setTimeout(() => this.cache.delete(key), ttl);
  }
}
```

### 2. Service Worker para PWA
```typescript
// Adicionar suporte offline
ng add @angular/pwa
```

### 3. Lazy Loading de Componentes
```typescript
const routes: Routes = [
  {
    path: 'player',
    loadComponent: () => import('./components/video-player/video-player').then(m => m.VideoPlayerComponent)
  }
];
```

### 4. Interceptor para APIs
```typescript
@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Adicionar headers, autenticação, etc.
    const apiReq = req.clone({
      setHeaders: {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
      }
    });
    return next.handle(apiReq);
  }
}
```

## 🔧 Configurações Avançadas

### 1. Proxy para desenvolvimento (angular.json)
```json
{
  "serve": {
    "builder": "@angular-devkit/build-angular:dev-server",
    "options": {
      "proxyConfig": "proxy.conf.json"
    }
  }
}
```

### 2. Arquivo proxy.conf.json
```json
{
  "/api/*": {
    "target": "https://api.externa.com",
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

### 3. Configuração de CORS no backend
```typescript
// Se você tiver controle do backend
app.use(cors({
  origin: ['http://localhost:4200', 'https://seu-dominio.com'],
  credentials: true
}));
```

## 📱 Funcionalidades Mobile

### 1. Gestos Touch
```typescript
@HostListener('touchstart', ['$event'])
onTouchStart(event: TouchEvent) {
  // Implementar gestos de swipe
}

@HostListener('touchend', ['$event'])
onTouchEnd(event: TouchEvent) {
  // Finalizar gestos
}
```

### 2. Picture-in-Picture
```typescript
async enablePiP(): Promise<void> {
  if ('pictureInPictureEnabled' in document) {
    await this.videoElement.requestPictureInPicture();
  }
}
```

### 3. Fullscreen API
```typescript
async toggleFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    await this.videoContainer.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}
```

## 🎨 Melhorias de UI/UX

### 1. Skeleton Loading
```scss
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 2. Virtual Scrolling para listas grandes
```typescript
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  template: `
    <cdk-virtual-scroll-viewport itemSize="200" class="viewport">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `
})
```

### 3. Animações personalizadas
```typescript
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)' }),
        animate('300ms ease-in', style({ transform: 'translateX(0%)' }))
      ])
    ])
  ]
})
```

## 🔐 Segurança

### 1. Sanitização de URLs
```typescript
import { DomSanitizer } from '@angular/platform-browser';

constructor(private sanitizer: DomSanitizer) {}

sanitizeUrl(url: string): SafeResourceUrl {
  return this.sanitizer.bypassSecurityTrustResourceUrl(url);
}
```

### 2. Validação de M3U
```typescript
validateM3U(content: string): boolean {
  return content.startsWith('#EXTM3U') && 
         content.includes('#EXTINF:');
}
```

## 📊 Analytics e Monitoramento

### 1. Google Analytics
```typescript
// Instalar: ng add @angular/google-analytics
gtag('event', 'play_video', {
  'video_title': title,
  'video_duration': duration
});
```

### 2. Error Tracking
```typescript
@Injectable()
export class ErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('Erro capturado:', error);
    // Enviar para serviço de monitoramento
  }
}
```

## 🚀 Deploy e Performance

### 1. Build otimizado
```bash
ng build --configuration production --aot --build-optimizer
```

### 2. Lazy loading de módulos
```typescript
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  }
];
```

### 3. Service Worker
```typescript
// Configurar cache strategies
import { SwUpdate } from '@angular/service-worker';

constructor(private swUpdate: SwUpdate) {
  if (swUpdate.isEnabled) {
    swUpdate.available.subscribe(() => {
      if (confirm('Nova versão disponível. Atualizar?')) {
        window.location.reload();
      }
    });
  }
}
```

---

Essas sugestões podem ser implementadas gradualmente para melhorar a funcionalidade e experiência do usuário do WebPlayer!

