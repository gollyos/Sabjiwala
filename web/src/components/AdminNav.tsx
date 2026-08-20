'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Boxes, Layers, Truck, BarChart3, Settings, Tag, Users, Bell, Store, ChevronDown, Menu, X, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAdminRole, type StaffRole } from '@/context/AdminRoleContext';
interface NavItem {
  name: string;
  nameGu?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
}

export function AdminNav() {
  const role = useAdminRole();
  const [supabase] = useState(() => createClient());
  const pathname = usePathname();
  const [manageOpen, setManageOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryItems: NavItem[] = [
    { name: 'Dashboard', nameGu: 'ડેશબોર્ડ', href: '/admin/dashboard', icon: Home, roles: ['owner', 'manager'] },
    { name: 'Orders', nameGu: 'ઓર્ડર્સ', href: '/admin/orders', icon: ShoppingBag, roles: ['owner', 'manager'] },
    { name: 'Mandi Purchases', nameGu: 'ખરીદી', href: '/admin/procurement', icon: Boxes, roles: ['owner', 'manager'] },
    { name: 'Pricing', nameGu: 'ભાવ નક્કી', href: '/admin/pricing', icon: Tag, roles: ['owner', 'manager'] },
    { name: 'Packing', nameGu: 'પેકિંગ', href: '/admin/packing', icon: Layers, roles: ['owner', 'manager', 'packing'] },
    { name: 'Delivery', nameGu: 'ડિલિવરી', href: '/admin/delivery', icon: Truck, roles: ['owner', 'manager'] },
    { name: 'Reports', nameGu: 'રિપોર્ટ્સ', href: '/admin/reports', icon: BarChart3, roles: ['owner', 'manager'] },
  ];
  const primaryNav = primaryItems.filter((item) => role && item.roles.includes(role));

  const secondaryItems: NavItem[] = [
    { name: 'Products Catalog', href: '/admin/products', icon: ShoppingBag, roles: ['owner', 'manager'] },
    { name: 'Staff Management', href: '/admin/staff', icon: Users, roles: ['owner'] },
    { name: 'Notifications & Alerts', href: '/admin/notifications', icon: Bell, roles: ['owner', 'manager'] },
    { name: 'System Settings', href: '/admin/settings', icon: Settings, roles: ['owner', 'manager'] },
  ];
  const secondaryNav = secondaryItems.filter((item) => role && item.roles.includes(role));

  const isSecondaryActive = secondaryNav.some((item) => pathname.startsWith(item.href));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand / Storefront Link */}
          <div className="flex items-center space-x-3">
            <Link href="/admin/dashboard" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs font-black text-sm">
                TT
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 tracking-tight block leading-tight">
                  TaazaTokra <span className="text-emerald-600 font-bold">Admin HQ</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Halol Central Control
                </span>
              </div>
            </Link>

            <span className="text-slate-200">|</span>

            <Link
              href="/"
              className="hidden lg:inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              title="Return to Customer Storefront"
            >
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer Store</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 text-xs">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = 
                item.href === '/admin/dashboard'
                  ? pathname === '/admin/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Dropdown: Management & Settings */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setManageOpen(!manageOpen)}
                className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isSecondaryActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>More</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {manageOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setManageOpen(false)}
                >
                  {secondaryNav.map((sec) => {
                    const SecIcon = sec.icon;
                    const isSecActive = pathname.startsWith(sec.href);
                    return (
                      <Link
                        key={sec.href}
                        href={sec.href}
                        onClick={() => setManageOpen(false)}
                        className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                          isSecActive
                            ? 'bg-emerald-50 text-emerald-800 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <SecIcon className="w-4 h-4 text-emerald-600" />
                        <span>{sec.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Logout from Admin HQ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = 
                item.href === '/admin/dashboard'
                  ? pathname === '/admin/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-xl flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Management & Settings
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs">
              {secondaryNav.map((sec) => {
                const SecIcon = sec.icon;
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    <SecIcon className="w-4 h-4 text-emerald-600" />
                    <span>{sec.name}</span>
                  </Link>
                );
              })}

              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                <Store className="w-4 h-4 text-slate-500" />
                <span>Return to Customer Store</span>
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full p-2.5 rounded-xl flex items-center gap-2 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer mt-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout from Admin HQ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
