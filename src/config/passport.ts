import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { getDB } from './db';
import { logger } from '../utils/logger';

passport.use(
    new GoogleStrategy(
        {
            clientID: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${env.BACKEND_URL}/api/auth/google/callback`, // backend URL, not client
            scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const db = getDB();
                const users = db.collection('users');

                // Check if user already exists by Google ID
                const existingUser = await users.findOne({ googleId: profile.id });
                if (existingUser) {
                    return done(null, existingUser);
                }

                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error('No email returned from Google'));
                }

                // Check if email already registered (without Google)
                const emailUser = await users.findOne({ email });
                if (emailUser) {
                    // Link Google ID to existing account
                    await users.updateOne(
                        { _id: emailUser._id },
                        {
                            $set: {
                                googleId: profile.id,
                                avatar: profile.photos?.[0]?.value || emailUser.avatar,
                            },
                        }
                    );
                    const updatedUser = await users.findOne({ _id: emailUser._id });
                    return done(null, updatedUser);
                }

                // Create brand new user
                const newUser = {
                    email,
                    googleId: profile.id,
                    name: profile.displayName,
                    avatar: profile.photos?.[0]?.value || null,
                    role: 'customer', // default role for Google sign-ups
                    emailVerified: true, // Google already verified
                    isActive: true,
                    passwordHash: null,
                    refreshToken: null,
                    createdAt: new Date(),
                };

                const result = await users.insertOne(newUser);
                return done(null, { ...newUser, _id: result.insertedId });
            } catch (error) {
                logger.error('Google OAuth error:', error);
                return done(error as Error);
            }
        }
    )
);

// Not using sessions (JWT instead), but Passport expects serialize/deserialize
passport.serializeUser((user: any, done) => {
    done(null, user._id.toString());
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const db = getDB();
        const user = await db.collection('users').findOne({ _id: id });
        done(null, user);
    } catch (err) {
        done(err);
    }
});

export default passport;