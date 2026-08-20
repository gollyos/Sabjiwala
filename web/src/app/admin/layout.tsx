'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert, Lock, ArrowLeft, RefreshCw, KeyRound, LogIn } from 'lucide-react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [supabase] = useState(() => createClient());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userMobile, setUserMobile] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const verifyAdminAccess = useCallback(async () => {
    try {
      setCheckingAuth(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setIsAuthorized(false);
        setIsAnonymous(true);
        setUserRole(null);
        setUserMobile(null);
        return;
      }

      setIsAnonymous(false);

      // Check role in user_roles table
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      if (error || !roleData || roleData.length === 0) {
        // Logged in as a customer, NOT staff or owner
        setIsAuthorized(false);
        setUserRole('customer');
        setUserMobile(session.user.phone || session.user.email || 'Customer Account');
      } else {
        const roles = roleData.map(r => r.role);
        const hasStaffAccess = roles.some(r => ['owner', 'manager', 'packing', 'procurement'].includes(r));
        setIsAuthorized(hasStaffAccess);
        setUserRole(roles.join(', '));
        setUserMobile(session.user.phone || session.user.email || 'Staff Account');
      }
    } catch (err) {
      console.error('Error verifying admin authorization:', err);
      setIsAuthorized(false);
    } finally {
      setCheckingAuth(false);
    }
  }, [supabase]);

  useEffect(() => {
    verifyAdminAccess();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      verifyAdminAccess();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, verifyAdminAccess]);

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse mb-4">
          <Lock className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Verifying Security & Staff Credentials...</p>
        <p className="text-xs text-slate-500 mt-1">Sabjiwala Admin HQ Security Guard</p>
      </div>
    );
  }

  // Access Denied / Customer Attempting to Access Admin
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 mx-auto flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-wider">
              {isAnonymous ? '401 • Authentication Required' : '403 • Access Denied (પ્રવેશ પ્રતિબંધિત)'}
            </span>
            <h1 className="text-xl font-black text-white mt-3 tracking-tight">
              Restricted Staff & Admin Area
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {isAnonymous 
                ? 'સબજીવાલા એડમિન પેનલ ઍક્સેસ કરવા માટે કૃપા કરીને અધિકૃત સ્ટાફ અથવા માલિક (Owner) એકાઉન્ટથી લૉગિન કરો.'
                : 'તમારું એકાઉન્ટ સામાન્ય ગ્રાહક (Customer) નું છે. સબજીવાલા એડમિન પેનલ, ભાવ બદલાવ અને ઓર્ડર કંટ્રોલ ફક્ત માન્ય માલિક (Owner) અને સ્ટાફ માટે જ ઉપલબ્ધ છે.'}
            </p>
          </div>

          {userMobile && (
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs font-mono">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Logged In Identity</div>
              <div className="text-slate-200 mt-0.5 truncate">{userMobile}</div>
              <div className="text-rose-400 text-[11px] mt-1">Role: {userRole || 'customer'} (No Admin Privileges)</div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Link
              href="/"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Storefront (ગ્રાહક પેજ પર જાઓ)</span>
            </Link>

            <button
              onClick={verifyAdminAccess}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Permissions</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Authorized Admin/Staff
  return <>{children}</>;
}
