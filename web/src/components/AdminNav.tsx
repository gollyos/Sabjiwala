'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  ShoppingBag, 
  Boxes, 
  Layers, 
  Truck, 
  BarChart3, 
  ChevronDown, 
  Settings, 
  Tag, 
  Users, 
  Building2, 
  Bell, 
  ArrowLeft,
  Menu,
  X,
  Store,
  LogOut
} from 'lucide-react';

export function AdminNav() {
  const pathname = usePathname();
  const [manageOpen, setManageOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryNav = [
    { name: 'Home', nameGu: 'હોમ', href: '/admin/dashboard', icon: Home },
    { name: 'Orders', nameGu: 'ઓર્ડર્સ', href: '/admin/orders', icon: ShoppingBag },
    { name: 'Procurement', nameGu: 'ખરીદી', href: '/admin/procurement', icon: Boxes },
    { name: 'Packing', nameGu: 'પેકિંગ', href: '/admin/packing', icon: Layers },
    { name: 'Delivery', nameGu: 'ડિલિવરી', href: '/admin/delivery', icon: Truck },
    { name: 'Reports', nameGu: 'રિપોર્ટ્સ', href: '/admin/reports', icon: BarChart3 },
  ];

  const secondaryNav = [
    { name: 'Pricing & APMC Rates', href: '/admin/pricing', icon: Tag },
    { name: 'Products Catalog', href: '/admin/products', icon: ShoppingBag },
    { name: 'Staff Management', href: '/admin/staff', icon: Users },
    { name: 'Notifications & Alerts', href: '/admin/notifications', icon: Bell },
    { name: 'System Settings', href: '/admin/settings', icon: Settings },
  ];

  const isSecondaryActive = secondaryNav.some((item) => pathname.startsWith(item.href));

  return (
    <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Left: Brand / Storefront Link */}
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition-colors"
              title="Return to Customer Storefront"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Storefront</span>
            </Link>
            <span className="text-slate-800">|</span>
            <Link href="/admin/dashboard" className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-extrabold text-sm text-white tracking-tight">
                TaazaTokra HQ <span className="text-emerald-400 text-xs font-medium">• Halol</span>
              </span>
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
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Manage / Settings Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setManageOpen(!manageOpen)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSecondaryActive
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>More</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {manageOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100"
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
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          isSecActive
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <SecIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{sec.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                localStorage.removeItem('taazatokra_admin_user');
                await fetch('/api/admin/login', { method: 'DELETE' });
                window.location.reload();
              }}
              className="ml-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
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
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
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
                  className={`p-3 rounded-2xl flex items-center gap-2 ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Management & Tools
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs">
              {secondaryNav.map((sec) => {
                const SecIcon = sec.icon;
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl flex items-center gap-2 text-slate-300 hover:bg-slate-800"
                  >
                    <SecIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{sec.name}</span>
                  </Link>
                );
              })}

              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  localStorage.removeItem('taazatokra_admin_user');
                  await fetch('/api/admin/login', { method: 'DELETE' });
                  window.location.reload();
                }}
                className="w-full p-2.5 rounded-xl flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout from Admin HQ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
