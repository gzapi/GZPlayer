import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
    declarations: [

    ],
    imports: [
        CommonModule,
        AuthRoutingModule,
        ReactiveFormsModule,
        LoginComponent,
        RegisterComponent,

        // Material modules
        MatInputModule,
        MatButtonModule,
        MatCardModule,
        MatIcon,
        MatProgressSpinnerModule,
    ]
})
export class AuthModule { }