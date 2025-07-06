// src/app/config/cache-config.ts

export interface LogoCacheConfig {
    maxSize: number;
    maxItems: number;
    expiryDays: number;
    supportedFormats: string[];
    preloadConcurrency: number;
    enableDebug: boolean;
    enableAutoCleanup: boolean;
    cleanupIntervalMinutes: number;
}

export const DEFAULT_CACHE_CONFIG: LogoCacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxItems: 1000,
    expiryDays: 7,
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    preloadConcurrency: 5,
    enableDebug: false,
    enableAutoCleanup: true,
    cleanupIntervalMinutes: 60
};

export const DEVELOPMENT_CACHE_CONFIG: LogoCacheConfig = {
    ...DEFAULT_CACHE_CONFIG,
    maxSize: 25 * 1024 * 1024, // 25MB em desenvolvimento
    maxItems: 500,
    expiryDays: 3,
    preloadConcurrency: 3,
    enableDebug: true,
    cleanupIntervalMinutes: 30
};

export const PRODUCTION_CACHE_CONFIG: LogoCacheConfig = {
    ...DEFAULT_CACHE_CONFIG,
    maxSize: 100 * 1024 * 1024, // 100MB em produção
    maxItems: 2000,
    expiryDays: 30,
    preloadConcurrency: 10,
    enableDebug: false,
    cleanupIntervalMinutes: 120
};

// Função para obter configuração baseada no ambiente
export function getCacheConfig(environment: any): LogoCacheConfig {
    if (environment.production) {
        return PRODUCTION_CACHE_CONFIG;
    } else {
        return DEVELOPMENT_CACHE_CONFIG;
    }
}

// CSS Classes para diferentes estados
export const LOGO_CSS_CLASSES = {
    loading: 'logo-loading',
    error: 'logo-error', 
    success: 'logo-success',
    cached: 'logo-cached',
    fallback: 'logo-fallback'
};

// Tipos de fallback baseado no tipo de conteúdo
export const FALLBACK_ICONS = {
    channel: 'tv',
    movie: 'movie',
    series: 'tv_series',
    default: 'image',
    error: 'broken_image'
};

// Configurações responsivas
export const RESPONSIVE_SIZES = {
    mobile: { width: 32, height: 32 },
    tablet: { width: 48, height: 48 },
    desktop: { width: 64, height: 64 },
    large: { width: 96, height: 96 }
};

// Breakpoints para responsividade
export const BREAKPOINTS = {
    mobile: 600,
    tablet: 960,
    desktop: 1280
};

// Validação de URLs
export const URL_VALIDATION = {
    protocols: ['http:', 'https:'],
    maxLength: 2048,
    minLength: 10,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    blockedDomains: [] // Adicione domínios bloqueados se necessário
};

// Configurações de retry para downloads falhados
export const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // ms
    exponentialBackoff: true,
    retryOn: [404, 500, 502, 503, 504] // HTTP status codes para retry
};