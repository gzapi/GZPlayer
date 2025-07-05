import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

declare var videojs: any;

@Component({
    selector: 'app-video-player',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatProgressBarModule
    ],
    templateUrl: './video-player.html',
    styleUrls: ['./video-player.scss']
})
export class VideoPlayerComponent implements OnInit, OnDestroy, AfterViewInit {
    @Input() url: string = '';
    @Input() title: string = '';
    @Input() autoplay: boolean = false;

    @ViewChild('videoElement', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;

    player: any;
    isLoading = false;
    hasError = false;
    errorMessage = '';

    ngOnInit(): void {
        // Carregar Video.js scripts se necessário
        this.loadVideoJS();
    }

    ngAfterViewInit(): void {
        this.initializePlayer();
    }

    ngOnDestroy(): void {
        if (this.player) {
            this.player.dispose();
        }
    }

  ngOnChanges(): void {
        if (this.player && this.url) {
            this.loadVideo();
        }
    }

    private loadVideoJS(): void {
        // Verificar se Video.js já está carregado
        if (typeof videojs !== 'undefined') {
            return;
        }

        // Carregar CSS do Video.js
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://vjs.zencdn.net/8.6.1/video-js.css';
        document.head.appendChild(link);

        // Carregar JavaScript do Video.js
        const script = document.createElement('script');
        script.src = 'https://vjs.zencdn.net/8.6.1/video.min.js';
        script.onload = () => {
            this.initializePlayer();
        };

        document.head.appendChild(script);
    }

    private initializePlayer(): void {
        if (typeof videojs === 'undefined' || !this.videoElement) {
            return;
        }

        try {
            this.player = videojs(this.videoElement.nativeElement, {
                controls: true,
                responsive: true,
                fluid: true,
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
                plugins: {
                    // Adicionar plugins conforme necessário
                }
            });

            // Event listeners
            this.player.on('loadstart', () => {
                this.isLoading = true;
                this.hasError = false;
            });

            this.player.on('canplay', () => {
                this.isLoading = false;
            });

            this.player.on('error', (error: any) => {
                this.isLoading = false;
                this.hasError = true;
                this.errorMessage = 'Erro ao carregar o vídeo. Verifique a URL ou tente novamente.';
                console.error('Video.js error:', error);
            });

            this.player.on('ended', () => {
                console.info('Video ended');
            });

            // Carregar vídeo se URL estiver disponível
            if (this.url) {
                this.loadVideo();
            }
        } catch (error) {
            console.error('Erro ao inicializar player:', error);
            this.hasError = true;
            this.errorMessage = 'Erro ao inicializar o player de vídeo.';
        }
    }

    private loadVideo(): void {
        if (!this.player || !this.url) {
            return;
        }

        this.isLoading = true;
        this.hasError = false;

        try {
            // Detectar tipo de stream
            const source = this.getVideoSource(this.url);
            
            this.player.src(source);
            
            if (this.autoplay) {
                this.player.ready(() => {
                this.player.play().catch((error: any) => {
                    console.warn('Autoplay failed:', error);
                });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar vídeo:', error);
            this.hasError = true;
            this.errorMessage = 'Erro ao carregar o vídeo.';
            this.isLoading = false;
        }
    }

    private getVideoSource(url: string): any {
        // Detectar tipo de stream baseado na URL
        if (url.includes('.m3u8')) {
            return {
                src: url,
                type: 'application/x-mpegURL'
            };
        } else if (url.includes('.mpd')) {
            return {
                src: url,
                type: 'application/dash+xml'
            };
        } else if (url.includes('.mp4')) {
            return {
                src: url,
                type: 'video/mp4'
            };
        } else {
            // Tentar como HLS por padrão
            return {
                src: url,
                type: 'application/x-mpegURL'
            };
        }
    }

    play(): void {
        if (this.player) {
            this.player.play();
        }
    }

    pause(): void {
        if (this.player) {
            this.player.pause();
        }
    }

    stop(): void {
        if (this.player) {
            this.player.pause();
            this.player.currentTime(0);
        }
    }

    toggleFullscreen(): void {
        if (this.player) {
            if (this.player.isFullscreen()) {
                this.player.exitFullscreen();
            } else {
                this.player.requestFullscreen();
            }
        }
    }

    setVolume(volume: number): void {
        if (this.player) {
            this.player.volume(volume / 100);
        }
    }

    retry(): void {
        this.hasError = false;
        this.loadVideo();
    }
}