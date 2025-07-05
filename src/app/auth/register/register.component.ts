import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule
    ],
})
export class RegisterComponent {
    registerForm: FormGroup;
    loading = false;
    errorMessage = '';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router
    ) {
            this.registerForm = this.fb.group({
                username: ['', [Validators.required, Validators.minLength(3)]],
                email: ['', [Validators.required, Validators.email]],
                password: ['', [Validators.required, Validators.minLength(6)]],
                confirmPassword: ['', Validators.required]
            }, {
                validators: this.passwordsMatchValidator
            });
    }

    passwordsMatchValidator(form: FormGroup) {
        const pass = form.get('password')?.value;
        const confirmPass = form.get('confirmPassword')?.value;
        return pass === confirmPass ? null : { passwordMismatch: true };
    }

    async onSubmit() {
        if (this.registerForm.invalid) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        try {
            const { username, email, password } = this.registerForm.value;
            // Assumindo que o AuthService tem método register similar ao login
            const result = await this.authService.register({ username, email, password }).toPromise();

            if (result && result.success) {
                this.router.navigate(['/login']);
            } else {
                this.errorMessage = result?.message || 'Erro ao registrar usuário.';
            }
        } catch (error: any) {
            this.errorMessage = error?.error?.message || 'Erro na requisição.';
        } finally {
            this.loading = false;
        }
    }
}