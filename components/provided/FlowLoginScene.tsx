'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import FlowLoginCard from './FlowLoginCard';

import ThemeToggle from '@/components/ui/ThemeToggle';

export default function FlowLoginScene() {
  const router = useRouter();
  const supabase = createClient();

  const handleAuthSubmit = async ({
    email,
    password,
    fullName,
    isSignUp,
  }: {
    email: string;
    password: string;
    fullName?: string;
    isSignUp: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSignUp) {
        // Attempt Supabase Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
            },
          },
        });

        if (error) {
          // If Supabase has an error or is unconfigured, explain clearly
          return { success: false, error: error.message };
        }

        // If sign up succeeded but email confirmation is required:
        if (data.user && !data.session) {
          return {
            success: false,
            error: 'Account created! Please check your email to confirm, or click "Explore as Demo Learner" below to proceed immediately.',
          };
        }

        // Auto redirect to onboarding
        router.push('/onboarding');
        return { success: true };
      } else {
        // Attempt Supabase Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return {
            success: false,
            error: error.message === 'Invalid login credentials'
              ? 'Invalid email or password. If you are new, click "Create Account" or use "Explore as Demo Learner".'
              : error.message,
          };
        }

        // Set user session info
        const normalizedEmail = email.trim().toLowerCase();
        localStorage.setItem('synapse_user_email', normalizedEmail);
        localStorage.setItem('synapse_demo_active', 'false');
        localStorage.removeItem('synapse_demo_active');
        const namePart = email.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        localStorage.setItem('synapse_user_name', formattedName);
        document.cookie = 'synapse_demo_session=true; path=/; max-age=86400';

        // Check if this specific user has completed their assessment & study details
        const userSpecificKey = `synapse_study_data_${normalizedEmail}`;
        const userStudyData = localStorage.getItem(userSpecificKey);
        if (!userStudyData) {
          // Send to personal details & proctored quiz!
          localStorage.removeItem('synapse_study_data');
          router.push('/onboarding');
        } else {
          localStorage.setItem('synapse_study_data', userStudyData);
          router.push('/app');
        }
        return { success: true };
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      return {
        success: false,
        error: err?.message || 'Unable to connect to auth service. You can use "Explore as Demo Learner" for instant demo.',
      };
    }
  };

  const handleDemoLogin = () => {
    // Set demo session cookie for middleware and client components
    document.cookie = 'synapse_demo_session=true; path=/; max-age=86400';
    try {
      const demoProfile = {
        name: 'Alex Rivera (Demo)',
        email: 'demo@synapse.edu',
        domain: 'React',
        level: 'intermediate',
        score: 88,
        goal: 'Master Concurrent React & Next.js Architecture',
        completed_at: new Date().toISOString(),
      };
      localStorage.setItem('synapse_demo_active', 'true');
      localStorage.setItem('synapse_user_name', 'Alex Rivera (Demo)');
      localStorage.setItem('synapse_user_email', 'demo@synapse.edu');
      localStorage.setItem('synapse_study_data', JSON.stringify(demoProfile));
      localStorage.setItem('synapse_study_data_demo@synapse.edu', JSON.stringify(demoProfile));
      router.push('/app');
    } catch (e) {
      router.push('/app');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) {
        alert('Google OAuth: ' + error.message);
      }
    } catch (err: any) {
      alert('OAuth error: ' + (err?.message || 'Failed to initialize Google login'));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col md:flex-row">
      {/* Left Column — Aesthetic Study Workspace & Brand (desktop/tablet) */}
      <div className="hidden md:flex flex-col justify-between w-1/2 lg:w-[52%] p-8 lg:p-14 border-r border-[var(--border)] bg-gradient-to-b from-[var(--canvas)] to-[var(--card)] relative overflow-hidden">
        {/* Ambient Warm Atmosphere */}
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-[var(--amber)] opacity-[0.07] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[var(--terracotta)] opacity-[0.06] blur-[100px] pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--amber)]/10 border border-[var(--amber)]/25 text-[var(--amber)] text-xs font-semibold uppercase tracking-wider mb-3">
            <span>●</span> Autonomous Peer Learning Ecosystem
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[var(--amber)] via-[var(--terracotta)] to-[var(--ink)] bg-clip-text text-transparent tracking-tight">
            Synapse
          </h1>
          <p className="text-[var(--muted)] text-base lg:text-lg mt-2 font-normal max-w-md">
            Learn together. Assess dynamically. Master anything through continuous peer collaboration.
          </p>
        </div>

        {/* Featured Study Table Photo with Stationeries */}
        <div className="relative z-10 my-6 flex flex-col items-center">
          <div className="relative w-full max-w-[500px] rounded-[22px] overflow-hidden border border-[var(--border)] shadow-lg bg-[var(--card)] group">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src="/workspace-table.jpg"
                alt="Warm aesthetic study desk with notebook, fountain pen, laptop, books, and coffee"
                fill
                priority
                sizes="(max-width: 1024px) 50vw, 45vw"
                className="object-cover object-center transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/60 via-transparent to-transparent opacity-80" />
              
              {/* Photo Overlay Caption */}
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-medium tracking-wide uppercase text-amber-200/90 mb-0.5">
                  The Deliberate Practice Environment
                </p>
                <p className="text-sm font-serif italic text-white/95 leading-snug">
                  Observe → Decide → Act → Evaluate → Adapt
                </p>
              </div>
            </div>
          </div>

          {/* Quick Pillars Badges */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[500px] mt-4">
            <div className="p-2.5 rounded-[14px] bg-[var(--card)] border border-[var(--border)] text-center">
              <span className="text-base block mb-0.5">🤖</span>
              <span className="text-[11px] font-semibold text-[var(--ink)] block">AI Assessment</span>
              <span className="text-[10px] text-[var(--muted)] block">Gemini 2.5 Flash</span>
            </div>
            <div className="p-2.5 rounded-[14px] bg-[var(--card)] border border-[var(--border)] text-center">
              <span className="text-base block mb-0.5">🤝</span>
              <span className="text-[11px] font-semibold text-[var(--ink)] block">Peer Matching</span>
              <span className="text-[10px] text-[var(--muted)] block">Complementary skills</span>
            </div>
            <div className="p-2.5 rounded-[14px] bg-[var(--card)] border border-[var(--border)] text-center">
              <span className="text-base block mb-0.5">📈</span>
              <span className="text-[11px] font-semibold text-[var(--ink)] block">Skill Mastery</span>
              <span className="text-[10px] text-[var(--muted)] block">Dynamic adaptation</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]/60">
          <span>&copy; {new Date().getFullYear()} Synapse Learning Platform</span>
          <span className="flex items-center gap-1.5 text-[var(--ok)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--ok)] inline-block animate-pulse" />
            System Live
          </span>
        </div>
      </div>

      {/* Right Column — Authentication Card */}
      <div className="w-full md:w-1/2 lg:w-[48%] flex items-center justify-center p-5 sm:p-8 lg:p-12 relative">
        {/* Desktop Theme Toggle */}
        <div className="hidden md:block absolute top-8 right-8 z-20">
          <ThemeToggle />
        </div>

        {/* Mobile Header (only on small screens) */}
        <div className="md:hidden absolute top-6 left-6 right-6 flex items-center justify-between z-20">
          <div>
            <h1 className="font-serif text-2xl font-bold bg-gradient-to-r from-[var(--amber)] to-[var(--terracotta)] bg-clip-text text-transparent">
              Synapse
            </h1>
            <p className="text-xs text-[var(--muted)]">Peer Learning Platform</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="w-full flex justify-center mt-14 md:mt-0">
          <FlowLoginCard
            onSubmit={handleAuthSubmit}
            onDemoLogin={handleDemoLogin}
            onGoogleLogin={handleGoogleLogin}
            defaultMode="login"
          />
        </div>
      </div>
    </div>
  );
}
