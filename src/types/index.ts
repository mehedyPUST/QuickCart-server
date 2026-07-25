export type UserRole = 'customer' | 'owner' | 'admin';

export interface ITokenPayload {
    userId: string;
    role: UserRole;
}

// Use this for request augmentation later
declare global {
    namespace Express {
        interface Request {
            user?: ITokenPayload & { iat?: number; exp?: number };
        }
    }
}