import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { LogoCacheService } from '../../services/local-cache';

@Component({
    selector: 'app-logo-image',
    standalone: true,
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatIconModule
    ],
    templateUrl: './logo-cache.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogoImageComponent implements OnInit, OnDestroy {
    @Input() src: string = '';
    @Input() alt: string = 'Logo';
    @Input() title: string = '';
    @Input() width: number = 48;
    @Input() height: number = 48;
    @Input() fallbackIcon: string = 'tv';
    @Input() fadeIn: boolean = true;
    @Input() showCacheStatus: boolean = false; 

    logoUrl: string = '';
    isLoading: boolean = false;
    hasError: boolean = false;
    isCached: boolean = false;

    private subscription?: Subscription;

    // Expor Math para o template
    Math = Math;

    constructor(
        private logoCacheService: LogoCacheService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.loadLogo();
    }

    ngOnDestroy(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    private loadLogo(): void {
        if (!this.src) {
            this.hasError = true;
            this.cdr.markForCheck();
            return;
        }

        this.isLoading = true;
        this.hasError = false;
        this.logoUrl = '';
        this.cdr.markForCheck();

        this.subscription = this.logoCacheService.getLogo(this.src).subscribe({
            next: (dataUrl) => {
                if (dataUrl) {
                    this.logoUrl = dataUrl;
                    this.isCached = true;
                } else {
                    this.hasError = true;
                }
                this.isLoading = false;
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.warn(`Erro ao carregar logo: ${this.src}`, error);
                this.hasError = true;
                this.isLoading = false;
                this.cdr.markForCheck();
            }
        });
    }

    onImageLoad(): void {
        this.isLoading = false;
        this.hasError = false;
        this.cdr.markForCheck();
    }

    onImageError(): void {
        this.hasError = true;
        this.isLoading = false;
        this.logoUrl = '';
        this.cdr.markForCheck();
    }

    // Método público para recarregar logo
    reload(): void {
        this.loadLogo();
    }
}