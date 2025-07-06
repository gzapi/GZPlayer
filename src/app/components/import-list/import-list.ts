import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

import { Functions } from '../../../functions';
import { M3uParserService } from '../../services/m3u-parser';

export interface ModalData {
    success: boolean;
    message?: string;
    file?: File;
}

export interface M3UGroupCategory {
    name: string;
    count: number;
}

export interface M3UMediaGroup {
    name: string;
    total: number;
    categories: M3UGroupCategory[];
}

export interface M3UData {
    totalChannels: number;
    totalMovies: number;
    totalSeries: number;
    grouped: {
        channels: M3UMediaGroup[];
        movies: M3UMediaGroup[];
        series: M3UMediaGroup[];
    };
}

@Component({
    selector: 'app-import-list',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './import-list.html',
    styleUrl: './import-list.scss'
})
export class ImportList {
    isLoading = false;
    showSummary = false;
    isDragOver = false;
    fileName = '';
    fileM3U: File | null = null;
    parsedData: M3UData | null = null;
    loadStatus: LoadStatus | null = null;

    private destroy$ = new Subject<void>();
    readonly types: ('channels' | 'movies' | 'series')[] = ['channels', 'movies', 'series'];

    constructor(
        public dialogRef: MatDialogRef<ImportList>,
        @Inject(MAT_DIALOG_DATA) public data: ModalData,
        private snackBar: MatSnackBar,
        public functions: Functions,
        private cdr: ChangeDetectorRef,
        public m3uParser: M3uParserService
    ) {}

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        this.fileName = '';

        if (file) {
            this.fileName = file.name;
            this.processFile(file);
        }

        input.value = '';
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver = false;

        const file = event.dataTransfer?.files?.[0];
        if (file) this.processFile(file);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver = true;
    }

    onDragLeave(): void {
        this.isDragOver = false;
    }

    processFile(file: File): void {
        if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
            this.showSnackBar('Por favor, selecione um arquivo .m3u ou .m3u8', 'error');
            return;
        }

        this.isLoading = true;
        this.loadStatus = null;
        this.cdr.markForCheck();

        this.m3uParser.parseM3UFromFile(file).pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (playlist) => {
                    this.parsedData = this.processGroupedData(playlist);
                    this.isLoading = false;
                    this.showSummary = true;
                    this.fileM3U = file;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    this.isLoading = false;
                    this.loadStatus = {
                        type: 'error',
                        icon: 'error',
                        message: error.message
                    };

                    this.showSnackBar('Erro ao carregar o arquivo', 'error');
                    this.cdr.markForCheck();
                }
            });
    }

    processGroupedData(raw: { channels: any[]; movies: any[]; series: any[] }): M3UData {
        const groupBy = (items: any[], type: 'channels' | 'movies' | 'series'): M3UMediaGroup[] => {
            const groupMap: Record<string, M3UMediaGroup> = {};

            for (const item of items) {
                const group = item.groupTitle || item.genre || 'Sem grupo';
                const category = item.genre || item.group || 'Geral';

                if (!groupMap[group]) {
                    groupMap[group] = {
                        name: group,
                        total: 0,
                        categories: []
                    };
                }

                const cat = groupMap[group].categories.find(c => c.name === category);
                if (cat) {
                    cat.count++;
                } else {
                    groupMap[group].categories.push({ name: category, count: 1 });
                }

                groupMap[group].total++;
            }

            return Object.values(groupMap);
        };

        return {
            totalChannels: raw.channels.length,
            totalMovies: raw.movies.length,
            totalSeries: raw.series.length,
            grouped: {
                channels: groupBy(raw.channels, 'channels'),
                movies: groupBy(raw.movies, 'movies'),
                series: groupBy(raw.series, 'series')
            }
        };
    }

    getGroupsArray(type: 'channels' | 'movies' | 'series'): M3UMediaGroup[] {
        return this.parsedData?.grouped[type] || [];
    }

    getGroupIcon(type: 'channels' | 'movies' | 'series'): string {
        const icons: Record<string, string> = {
            channels: 'tv',
            movies: 'movie',
            series: 'tv_gen'
        };
        return icons[type] || 'folder';
    }

    closeModal(): void {
        this.dialogRef.close({
            success: false,
            message: 'Operação cancelada'
        });
    }

    confirmUpload(): void {
        this.dialogRef.close({
            success: true,
            message: 'M3U enviado com sucesso'
        });
    }

    async uploadM3U(): Promise<void> {
        try {
            if (!this.fileM3U) {
                this.showSnackBar('Por favor, selecione um arquivo .m3u ou .m3u8', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('playlist', this.fileM3U);
            this.isLoading = true;

            const data = await this.functions.formPostExpress(formData, 'api/upload', true);

            if (data?.success === true) {
                this.confirmUpload();
            } else {
                console.error('Erro ao enviar M3U para o servidor:', data);
                this.snackBar.open('Erro ao enviar M3U para o servidor', 'OK', { duration: 5000 });
            }

            this.isLoading = false;
        } catch (error) {
            this.isLoading = false;
            console.error('Erro ao enviar M3U para o servidor:', error);
            this.snackBar.open('Erro ao enviar M3U para o servidor', 'OK', { duration: 5000 });
        } finally {
            this.isLoading = false;
        }
    }

    private showSnackBar(message: string, type: 'success' | 'error' | 'warning'): void {
        const config = {
            duration: type === 'error' ? 6000 : 4000,
            panelClass: [`snackbar-${type}`]
        };

        this.snackBar.open(message, 'Fechar', config);
    }
}

interface LoadStatus {
    type: 'success' | 'error' | 'warning';
    icon: string;
    message: string;
}