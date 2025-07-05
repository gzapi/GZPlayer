import { User } from './user.model';

export interface AuthResponse {
    access_token: string;
    user: User;
    expires_in?: number;
    message?: string;
    success: boolean;
}