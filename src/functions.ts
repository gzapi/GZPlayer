import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from './environments/environment';
import { lastValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class Functions {

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

    async get(rota: string): Promise<{ success: boolean; message?: string; data?: any[] } | null> {
        try {
            const token = sessionStorage.getItem('token');
            let headers = new HttpHeaders();

            if (token) {
                headers = headers.set('Authorization', `Bearer ${token}`);
            }

            const result = await lastValueFrom(
                this.http.get<{ success: boolean; message?: string; data?: any[] }>(`${environment.API_URL}/${rota}`, { headers })
            );

            if (!result.success) {
                console.error('sendGetExpress retornou success: false.', result);
            }

            return result;
        } catch (error) {
            console.error('Erro na função get.', error);
            return null;
        }
    }
}