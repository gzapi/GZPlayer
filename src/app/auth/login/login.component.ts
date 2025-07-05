import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ThemeService } from '../../services/theme';
import { AppComponent } from '../../app';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['../../../styles.scss'],
    encapsulation: ViewEncapsulation.None,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIcon
    ],
})
export class LoginComponent {
    loginForm: FormGroup;
    hidePassword = true;
    loading = false;
    errorMessage = '';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        public themeService: ThemeService
    ) {
        this.loginForm = this.fb.group({
            login: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    async onSubmit() {
        if (this.loginForm.invalid) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        try {
            const result = await lastValueFrom(
                this.authService.login(this.loginForm.value)
            );

            if (result && result.user) {
                this.router.navigate(['/']);
            } else {
                this.errorMessage = result?.message || 'Erro desconhecido.';
            }
        } catch (error: any) {
            this.errorMessage = error?.error?.message || 'Erro ao fazer login.';
        } finally {
            this.loading = false;
        }
    }
}