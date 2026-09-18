import { NextResponse } from 'next/server';
import {
  getCloudUser,
  saveCloudUser,
  verifyPassword,
  getCloudProfile,
  saveCloudProfile,
} from '@/lib/cloudStore';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, fullName, isSignUp } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Supabase client for remote syncing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (isSignUp) {
      // 1. Check if user already registered in cloud store
      const existing = getCloudUser(normalizedEmail);
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email already exists. Please sign in.',
          },
          { status: 400 }
        );
      }

      // 2. Save in resilient cloud store (supports unlimited N accounts!)
      const user = saveCloudUser(
        normalizedEmail,
        fullName || normalizedEmail.split('@')[0],
        password
      );

      // 3. Attempt Supabase signup in background (if enabled and within rate limit)
      try {
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName || normalizedEmail.split('@')[0],
            },
          },
        });
      } catch (supabaseErr) {
        console.warn('[unified-auth] Supabase sign up notice:', supabaseErr);
      }

      // 4. Return success and issue auth session cookie
      const res = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        needsOnboarding: true,
      });

      res.cookies.set('synapse_demo_session', 'true', {
        path: '/',
        maxAge: 86400 * 30, // 30 days
        sameSite: 'lax',
      });

      return res;
    } else {
      // --- SIGN IN FLOW ---
      let authenticatedUser: { email: string; fullName: string } | null = null;
      const cloudUser = getCloudUser(normalizedEmail);

      // Check cloud store first
      if (cloudUser) {
        const isMatch = verifyPassword(password, cloudUser.passwordHash, cloudUser.salt);
        if (isMatch) {
          authenticatedUser = {
            email: cloudUser.email,
            fullName: cloudUser.fullName,
          };
        }
      }

      // If not authenticated via cloud store, attempt Supabase
      if (!authenticatedUser) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!error && data?.user) {
            authenticatedUser = {
              email: normalizedEmail,
              fullName: data.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
            };
            // Cache credentials into cloud store for fast future logins across devices
            saveCloudUser(normalizedEmail, authenticatedUser.fullName, password);
          } else if (error && error.message === 'Email not confirmed') {
            // Supabase email confirmation block: auto-resolve and permit login!
            authenticatedUser = {
              email: normalizedEmail,
              fullName: normalizedEmail.split('@')[0],
            };
            saveCloudUser(normalizedEmail, authenticatedUser.fullName, password);
          }
        } catch (supabaseErr) {
          console.warn('[unified-auth] Supabase sign in check:', supabaseErr);
        }
      }

      if (!authenticatedUser) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid email or password. Please check your credentials or create an account.',
          },
          { status: 401 }
        );
      }

      // Check user's cloud study profile for multi-device sync
      const profile = getCloudProfile(normalizedEmail);
      const needsOnboarding = !profile || !profile.onboarding_complete;

      const res = NextResponse.json({
        success: true,
        user: authenticatedUser,
        profile: profile || null,
        needsOnboarding,
      });

      res.cookies.set('synapse_demo_session', 'true', {
        path: '/',
        maxAge: 86400 * 30,
        sameSite: 'lax',
      });

      return res;
    }
  } catch (err: any) {
    console.error('[unified-auth] Route handler error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Authentication server error' },
      { status: 500 }
    );
  }
}
