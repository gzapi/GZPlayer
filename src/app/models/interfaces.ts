export interface Channel {
    id: string;
    title: string;
    url: string;
    tvg_logo?: string;
    year?: number;
    genre?: string;
    duration?: string;
    synopsis?: string;
    isFavorite?: boolean;
    item_type?: string;
    item_subtype?: string;
}

export interface Movie {
    id: string;
    title: string;
    url: string;
    tvg_logo?: string;
    year?: number;
    genre?: string;
    duration?: string;
    synopsis?: string;
    isFavorite?: boolean;
    item_type?: string;
    item_subtype?: string;
}

export interface Series {
    id: string;
    title: string;
    url: string;
    tvg_logo?: string;
    year?: number;
    genre?: string;
    duration?: string;
    synopsis?: string;
    isFavorite?: boolean;
    item_type?: string;
    item_subtype?: string;
    seasons?: number;
}

export interface ProgramInfo {
    title: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    image?: string;
}

export interface M3UPlaylist {
    channels: Channel[];
    movies: Movie[];
    series: Series[];
}

export interface Theme {
    name: string;
    isDark: boolean;
}

export interface FavoriteItem {
    id: string;
    type: 'channel' | 'movie' | 'series';
    data: Channel | Movie | Series;
}

