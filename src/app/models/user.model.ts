export interface User {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    is_active?: boolean;
    last_login?: string;
    created_at?: string;
    updated_at?: string;
}