import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private tokenKey = 'webplayer_token';
    private userSubject = new BehaviorSubject<User | null>(null);
    user$: Observable<User | null> = this.userSubject.asObservable();

    isLoggedIn$: Observable<boolean> = this.user$.pipe(
        map(user => !!user)
    );

    constructor(
        private http: HttpClient, 
        private router: Router
    ) {
        this.loadUserFromStorage();
    }

    login(data: { login: string; password: string }): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.API_URL}/api/auth/login`, data).pipe(
            tap(response => {
                if (response) {
                    this.setSession(response);
                }
            })
        );
    }

    register(data: { username: string; email: string; password: string }): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.API_URL}/api/auth/register`, data);
    }

    logout(): void {
        sessionStorage.removeItem('user');
        this.userSubject.next(null);
        this.router.navigate(['/auth/login']);
    }

    isAuthenticated(): boolean {
        return !!this.getUser();
    }

    getUser(): string | null {
        return sessionStorage.getItem('user');
    }

    private setSession(response: AuthResponse): void {
        sessionStorage.setItem('user', JSON.stringify(response.user));
        this.userSubject.next(response.user);
    }

    private loadUserFromStorage(): void {
        const userRaw = this.getUser();

        if (userRaw) {
            try {
                const user: User = JSON.parse(userRaw);
                this.userSubject.next(user);
            } catch (e) {
                console.warn('Erro ao carregar usuário salvo.', e);
            }
        }
    }
}