import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  // Extract public origin from forwarded proxy headers to ensure mobile devices never redirect to localhost
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  let publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin;

  // Safeguard: If running in production or origin has localhost on deployed Vercel, prioritize production host
  if (publicOrigin.includes('localhost') && typeof window === 'undefined') {
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      publicOrigin = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
      publicOrigin = `https://${process.env.VERCEL_URL}`;
    } else {
      publicOrigin = 'https://synapse1-eta.vercel.app';
    }
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // ignore
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session) {
      const res = NextResponse.redirect(`${publicOrigin}${next}`);
      res.cookies.set('synapse_demo_session', 'true', {
        path: '/',
        maxAge: 86400 * 30,
        sameSite: 'lax',
      });
      return res;
    }
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=auth_callback_error`);
}
