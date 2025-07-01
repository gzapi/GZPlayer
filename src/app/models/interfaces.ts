export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  isFavorite?: boolean;
}

export interface Movie {
  id: string;
  title: string;
  url: string;
  poster?: string;
  year?: number;
  genre?: string;
  duration?: string;
  synopsis?: string;
  isFavorite?: boolean;
}

export interface Series {
  id: string;
  title: string;
  url: string;
  poster?: string;
  year?: number;
  genre?: string;
  seasons?: number;
  synopsis?: string;
  isFavorite?: boolean;
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

