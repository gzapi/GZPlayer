import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service'; // ajuste o caminho conforme seu projeto
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class AuthGuard implements CanActivate {

    constructor(
        private authService: AuthService, 
        private router: Router
    ) {}

    canActivate(): Observable<boolean | UrlTree> {
        return this.authService.isLoggedIn$.pipe(
            map(isLoggedIn => {
                if (isLoggedIn) {
                    return true;
                } else {
                    return this.router.createUrlTree(['/auth/login']);
                }
            })
        );
    }
}