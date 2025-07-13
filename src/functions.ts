import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from './environments/environment';
import { lastValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class Functions {

    public readonly API_KEY = '6e8cf205716f657a024d60ffeb60edd6';
    public readonly BASE_URL = 'https://api.themoviedb.org/3';
    public readonly IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

    constructor(
        private http: HttpClient
    ) { }

    async formPostExpress(dados: any, rota: string, upload: boolean = false): Promise<{ success: boolean; message?: string; data?: any[] } | null> {
        try {
            let headers = new HttpHeaders();
            const userString = sessionStorage.getItem('user');

            if (userString) {
                try {
                    const user = JSON.parse(userString);
                    if (user?.id) {
                        headers = headers.set('Authorization', String(user.id));
                    }
                } catch (error) {
                    console.error('Erro ao fazer parse do usuário', error);
                }
            }

            if (!upload) {
                headers = headers.set('Content-Type', 'application/json');
            }

            const result = await lastValueFrom(
                this.http.post<{ success: boolean; message?: string; data?: any[] }>(`${environment.API_URL}/${rota}`, dados, { headers })
            );

            if (!result.success) {
                console.error('formPostExpress retornou success: false.', result);
            }

            return result;
        } catch (error) {
            console.error('Erro na função formPostExpress.\n', error);
            return null;
        }
    }

    async get(url: string, page: number = 1, query: string = ''): Promise<{ data: any[] } | null> {
        try {
            const params = new HttpParams()
                .set('api_key', this.API_KEY)
                .set('query', query)
                .set('page', page.toString())
                .set('language', 'pt-BR');

            const result = await lastValueFrom(
                this.http.get<{ data: any[] }>(url, { params })
            );

            if (!result) {
                console.error('get retornou success: false.', result);
            }

            return result;
        } catch (error) {
            console.error('Erro na função get.', error);
            return null;
        }
    }

    sanitizeKey(title: string): string {
        return title
            .normalize('NFD') // Normaliza caracteres acentuados
            .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
            .toLowerCase() // Converte para minúsculo
            .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais, mantém apenas letras, números e espaços
            .trim() // Remove espaços no início e fim
            .replace(/\s+/g, '_'); // Substitui espaços por underscore
    }
}