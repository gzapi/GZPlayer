import { Routes } from '@angular/router';
import { ChannelListComponent } from './components/channel-list/channel-list';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'channels', pathMatch: 'full' },

    // Rotas protegidas
    { path: 'channels', component: ChannelListComponent, canActivate: [AuthGuard] },
    { path: 'channels/:category', component: ChannelListComponent, canActivate: [AuthGuard] },

    { path: 'movies', component: ChannelListComponent, canActivate: [AuthGuard] },
    { path: 'movies/:category', component: ChannelListComponent, canActivate: [AuthGuard] },

    { path: 'series', component: ChannelListComponent, canActivate: [AuthGuard] },
    { path: 'series/:category', component: ChannelListComponent, canActivate: [AuthGuard] },

    { path: 'favorites', component: ChannelListComponent, canActivate: [AuthGuard] },
    { path: 'favorites/:category', component: ChannelListComponent, canActivate: [AuthGuard] },

    // Módulo de autenticação sem proteção (login, registro)
    {
        path: 'auth',
        loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule),
    },

    { path: '**', redirectTo: 'channels' },
];