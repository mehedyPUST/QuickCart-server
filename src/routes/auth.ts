import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDB } from '../config/db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/hash';
import { generateOTP } from '../utils/otp';
import { sendEmail } from '../utils/email';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import passport from '../config/passport';
import { ObjectId } from 'mongodb';

const router = Router();

// --- Zod Schemas ---
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['customer', 'owner']),
});

const verifyEmailSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(8),
});

// Helper to set JWT cookies
function setTokenCookies(res: Response, userId: string, role: string) {
    const payload = { userId, role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh', // only sent to refresh endpoint
    });

    return refreshToken; // returned so we can store hashed version
}

// ---- ROUTES ----

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, role } = registerSchema.parse(req.body);

        const db = getDB();
        const users = db.collection('users');

        // Check if email exists
        const existing = await users.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const newUser = {
            email: email.toLowerCase(),
            passwordHash,
            role,
            name: email.split('@')[0], // temporary name
            emailVerified: false,
            verificationOtp: {
                code: otp,
                expiresAt: otpExpiresAt,
            },
            isActive: true,
            googleId: null,
            avatar: null,
            phone: null,
            refreshToken: null,
            createdAt: new Date(),
        };

        await users.insertOne(newUser);

        // Send OTP email
        await sendEmail({
            to: email,
            subject: 'Verify your email - QuickCart',
            html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`,
        });

        res.status(201).json({ message: 'Registration successful. Please check your email for verification code.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
    try {
        const { email, otp } = verifyEmailSchema.parse(req.body);

        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.emailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const storedOtp = user.verificationOtp;
        if (!storedOtp || storedOtp.code !== otp || new Date() > new Date(storedOtp.expiresAt)) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Mark as verified and clear OTP
        await users.updateOne(
            { _id: user._id },
            { $set: { emailVerified: true }, $unset: { verificationOtp: '' } }
        );

        // Generate tokens and set cookies
        const refreshToken = setTokenCookies(res, user._id.toString(), user.role);

        // Store hashed refresh token
        await users.updateOne(
            { _id: user._id },
            { $set: { refreshToken: hashToken(refreshToken) } }
        );

        res.json({ message: 'Email verified successfully', user: { _id: user._id, email: user.email, role: user.role } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user || !user.passwordHash) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        if (!user.isActive) {
            return res.status(403).json({ message: 'Account is suspended' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate tokens
        const refreshToken = setTokenCookies(res, user._id.toString(), user.role);

        // Store hashed refresh token
        await users.updateOne(
            { _id: user._id },
            { $set: { refreshToken: hashToken(refreshToken) } }
        );

        res.json({ message: 'Login successful', user: { _id: user._id, email: user.email, role: user.role } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.refresh_token;
        if (!token) {
            return res.status(401).json({ message: 'No refresh token' });
        }

        let payload;
        try {
            payload = verifyRefreshToken(token);
        } catch {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ _id: new ObjectId(payload.userId) });

        if (!user || !user.refreshToken) {
            return res.status(401).json({ message: 'Invalid session' });
        }

        // Verify hashed token matches
        if (user.refreshToken !== hashToken(token)) {
            return res.status(401).json({ message: 'Token reuse detected' });
        }

        // Rotate tokens
        const newRefreshToken = setTokenCookies(res, user._id.toString(), user.role);
        await users.updateOne(
            { _id: user._id },
            { $set: { refreshToken: hashToken(newRefreshToken) } }
        );

        res.json({ message: 'Tokens refreshed' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
    try {
        const db = getDB();
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user!.userId) },
            { $set: { refreshToken: null } }
        );

        res.clearCookie('access_token');
        res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
        res.json({ message: 'Logged out' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);

        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if email exists
            return res.json({ message: 'If that email exists, a reset code has been sent.' });
        }

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await users.updateOne(
            { _id: user._id },
            { $set: { resetOtp: { code: otp, expiresAt: otpExpiresAt } } }
        );

        await sendEmail({
            to: email,
            subject: 'Password Reset - QuickCart',
            html: `<p>Your password reset code is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`,
        });

        res.json({ message: 'If that email exists, a reset code has been sent.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);

        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        const storedOtp = user.resetOtp;
        if (!storedOtp || storedOtp.code !== otp || new Date() > new Date(storedOtp.expiresAt)) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await users.updateOne(
            { _id: user._id },
            {
                $set: { passwordHash },
                $unset: { resetOtp: '' },
            }
        );

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Google OAuth routes (unchanged from before)
router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.CLIENT_URL}/login?error=google` }),
    async (req, res) => {
        try {
            const user = req.user as any;
            const refreshToken = setTokenCookies(res, user._id.toString(), user.role);

            const db = getDB();
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { refreshToken: hashToken(refreshToken) } }
            );

            const redirectUrl = user.role === 'owner' ? `${env.CLIENT_URL}/owner/dashboard` : `${env.CLIENT_URL}/dashboard`;
            res.redirect(redirectUrl);
        } catch (error) {
            logger.error(error);
            res.redirect(`${env.CLIENT_URL}/login?error=server`);
        }
    }
);

export default router;