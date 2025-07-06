import { Directive, Input, ElementRef, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { Subscription } from 'rxjs';
import { LogoCacheService } from '../services/local-cache';

@Directive({
    selector: '[appLogoCached]',
    standalone: true
})
export class LogoCacheDirective implements OnInit, OnDestroy {
    @Input('appLogoCached') logoUrl: string = '';
    @Input() fallbackSrc: string = '';
    @Input() loadingClass: string = 'logo-loading';
    @Input() errorClass: string = 'logo-error';
    @Input() successClass: string = 'logo-success';

    private subscription?: Subscription;
    private originalSrc: string = '';

    constructor(
        private el: ElementRef<HTMLImageElement>,
        private renderer: Renderer2,
        private logoCacheService: LogoCacheService
    ) {}

    ngOnInit(): void {
        // Salvar src original se existir
        this.originalSrc = this.el.nativeElement.src || '';
        this.loadCachedLogo();
    }

    ngOnDestroy(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    private loadCachedLogo(): void {
        if (!this.logoUrl) {
            this.setError();
            return;
        }

        // Adicionar classe de loading
        this.renderer.addClass(this.el.nativeElement, this.loadingClass);
        this.renderer.removeClass(this.el.nativeElement, this.errorClass);
        this.renderer.removeClass(this.el.nativeElement, this.successClass);

        this.subscription = this.logoCacheService.getLogo(this.logoUrl).subscribe({
            next: (dataUrl) => {
                if (dataUrl) {
                    this.renderer.setAttribute(this.el.nativeElement, 'src', dataUrl);
                    this.setSuccess();
                } else {
                    this.setError();
                }
            },
            error: (error) => {
                console.warn(`Erro ao carregar logo: ${this.logoUrl}`, error);
                this.setError();
            }
        });
    }

    private setSuccess(): void {
        this.renderer.removeClass(this.el.nativeElement, this.loadingClass);
        this.renderer.removeClass(this.el.nativeElement, this.errorClass);
        this.renderer.addClass(this.el.nativeElement, this.successClass);
    }

    private setError(): void {
        this.renderer.removeClass(this.el.nativeElement, this.loadingClass);
        this.renderer.addClass(this.el.nativeElement, this.errorClass);
        
        // Usar fallback se disponível
        if (this.fallbackSrc) {
            this.renderer.setAttribute(this.el.nativeElement, 'src', this.fallbackSrc);
        } else if (this.originalSrc) {
            this.renderer.setAttribute(this.el.nativeElement, 'src', this.originalSrc);
        }
    }
}

// CSS classes sugeridas para adicionar ao seu global styles:
/*
.logo-loading {
    opacity: 0.6;
    filter: blur(1px);
    transition: all 0.3s ease;
}

.logo-error {
    opacity: 0.4;
    filter: grayscale(100%);
}

.logo-success {
    opacity: 1;
    filter: none;
    transition: all 0.3s ease;
}
*/