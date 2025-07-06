import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

import { ThemeService } from '../../services/theme';
import { FavoritesService } from '../../services/favorites';
import { M3UPlaylist } from '../../models/interfaces';
import { AuthService } from '../../auth/auth.service';
import { ImportList } from '../import-list/import-list';
import { MatDialog } from '@angular/material/dialog';
import { AppComponent } from '../../app';

interface PlaylistStats {
    channels: number;
    movies: number;
    series: number;
}

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatToolbarModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatMenuModule,
        MatDividerModule
    ],
    templateUrl: './header.html',
    styleUrls: ['./header.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
    @Input() playlist: M3UPlaylist | null = null;
    @Input() searchTerm = '';
    @Output() searchTermChange = new EventEmitter<string>();
    @Output() searchChange = new EventEmitter<string>();
    @Output() themeToggle = new EventEmitter<void>();

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    isDarkMode = false;
    favoritesCount = 0;
    playlistStats: PlaylistStats | null = null;

    private destroy$ = new Subject<void>();
    private searchSubject = new Subject<string>();

    constructor(
        private themeService: ThemeService,
        private favoritesService: FavoritesService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private dialog: MatDialog,
        public appComponent: AppComponent
    ) {}

    ngOnInit(): void {
        // Observar mudanças de tema
        this.themeService.currentTheme$.pipe(
            takeUntil(this.destroy$)
        ).subscribe(theme => {
            this.isDarkMode = theme.isDark;
        });

        // Observar mudanças nos favoritos
        this.favoritesService.favorites$.pipe(
            takeUntil(this.destroy$)
        ).subscribe(favorites => {
            this.favoritesCount = favorites.length;
        });

        // Configurar busca com debounce
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(term => {
            this.searchChange.emit(term);
        });

        // Atualizar estatísticas da playlist
        this.updatePlaylistStats();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnChanges(): void {
        this.updatePlaylistStats();
    }

    toggleTheme(): void {
        this.themeToggle.emit();
    }

    onSearch(): void {
        this.searchTermChange.emit(this.searchTerm);
        this.searchChange.emit(this.searchTerm);
    }

    onSearchInput(): void {
        this.searchTermChange.emit(this.searchTerm);
        this.searchSubject.next(this.searchTerm);
    }

    public importM3U(): void {
        const dialogRef = this.dialog.open(ImportList, {
            width: '400px',
            data: {
                title: 'Confirmar Ação',
                content: 'Tem certeza que deseja continuar?',
                confirmText: 'Sim',
                cancelText: 'Não'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            this.snackBar.open(result.message, 'Fechar');

            if (result) {
                console.log('Usuário confirmou');
                this.appComponent.loadM3U({});
            } else {
                console.log('Usuário cancelou');
            }
        });
    }

    clearFavorites(): void {
        if (this.favoritesCount === 0) {
            this.snackBar.open('Não há favoritos para limpar', 'OK', { duration: 3000 });
            return;
        }

        if (confirm('Tem certeza que deseja limpar todos os favoritos?')) {
            this.favoritesService.clearAllFavorites();
            this.snackBar.open('Favoritos limpos com sucesso', 'OK', { duration: 3000 });
        }
    }

    exportFavorites(): void {
        const favorites = this.favoritesService.getAllFavorites();
        
        if (favorites.length === 0) {
            this.snackBar.open('Não há favoritos para exportar', 'OK', { duration: 3000 });
            return;
        }

        const dataStr = JSON.stringify(favorites, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `webplayer-favoritos-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
        this.snackBar.open('Favoritos exportados com sucesso', 'OK', { duration: 3000 });
    }

    importFavorites(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const favorites = JSON.parse(e.target?.result as string);
                
                if (!Array.isArray(favorites)) {
                    throw new Error('Formato inválido');
                }

                // Validar estrutura dos favoritos
                const isValid = favorites.every(fav => fav.id && fav.type && fav.data && ['channel', 'movie', 'series'].includes(fav.type));

                if (!isValid) {
                    throw new Error('Estrutura de dados inválida');
                }

                // Importar favoritos
                favorites.forEach(fav => {this.favoritesService.addToFavorites(fav.data, fav.type);});
                this.snackBar.open(`${favorites.length} favoritos importados com sucesso`, 'OK', { duration: 3000 });
            } catch (error) {
                console.error('Erro ao importar favoritos:', error);
                this.snackBar.open('Erro ao importar favoritos. Verifique o arquivo.', 'OK', { duration: 3000 });
            }
        };

        reader.readAsText(file);

        // Limpar input
        this.fileInput.nativeElement.value = '';
    }

    showAbout(): void {
        const message = `
            WebPlayer Angular v1.0
            
            Um player web moderno para listas M3U com suporte a:
            • Canais de TV
            • Filmes e Séries
            • Sistema de Favoritos
            • Temas Claro/Escuro
            • Interface Responsiva
            
            Desenvolvido com Angular e Material Design
        `;
        
        this.snackBar.open(message, 'Fechar', { 
            duration: 10000,
            panelClass: 'about-snackbar'
        });
    }

    logout(): void {
        this.authService.logout();
    }

    private updatePlaylistStats(): void {
        if (!this.playlist) {
            this.playlistStats = null;
            return;
        }

        this.playlistStats = {
            channels: this.playlist.channels.length,
            movies: this.playlist.movies.length,
            series: this.playlist.series.length
        };
    }
}