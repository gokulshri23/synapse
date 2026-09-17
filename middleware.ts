import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check for demo session cookie
  const isDemo = request.cookies.get('synapse_demo_session')?.value === 'true';
  const pathname = request.nextUrl.pathname;

  // If Supabase is not configured or in demo mode, allow access
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  let user = null;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const authRes = await supabase.auth.getUser();
    user = authRes.data?.user || null;
  } catch (err) {
    console.warn('Middleware auth check warning:', err);
  }

  // Protected routes: redirect to login if neither authenticated nor demo
  if (!user && !isDemo && (pathname.startsWith('/app') || pathname.startsWith('/onboarding'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated or active demo users away from login
  if ((user || isDemo) && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/app/:path*', '/onboarding', '/login'],
};
