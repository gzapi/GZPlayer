import { Routes } from '@angular/router';
import { ChannelListComponent } from './components/channel-list/channel-list';

export const routes: Routes = [
  { path: '', redirectTo: '/channels', pathMatch: 'full' },
  { path: 'channels', component: ChannelListComponent },
  { path: 'movies', component: ChannelListComponent }, // Reutilizando componente com filtro
  { path: 'series', component: ChannelListComponent }, // Reutilizando componente com filtro
  { path: 'favorites', component: ChannelListComponent }, // Reutilizando componente com filtro
  { path: '**', redirectTo: '/channels' }
];

