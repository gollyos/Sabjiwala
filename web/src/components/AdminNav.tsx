'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Tag, 
  Package, 
  Truck, 
  Layers, 
  BarChart3, 
  Boxes, 
  ArrowLeft,
  ChevronDown,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Building2,
  Bell,
  Settings
} from 'lucide-react';

export function AdminNav() {
  const pathname = usePathname();
  const [reportsOpen, setReportsOpen] = useState(false);

  const isReportActive = pathname.startsWith('/admin/reports');

  return (
    <div className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Brand & Storefront Link */}
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <span className="text-slate-800">|</span>
          <Link href="/admin/dashboard" className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-extrabold text-sm text-white tracking-wide">
              Sabjiwala HQ <span className="text-slate-400 font-normal text-xs">• Halol</span>
            </span>
          </Link>
        </div>

        {/* Center / Right: Nav Navigation Links */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          
          <Link
            href="/admin/dashboard"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/dashboard'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>

          {/* Sub-Reports Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setReportsOpen(!reportsOpen)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isReportActive
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Detailed Reports</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {reportsOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1"
                onMouseLeave={() => setReportsOpen(false)}
              >
                <Link
                  href="/admin/reports/orders"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/orders' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Orders Report (ઓર્ડર્સ)</span>
                </Link>
                <Link
                  href="/admin/reports/sales"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/sales' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sales & Financials</span>
                </Link>
                <Link
                  href="/admin/reports/products"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/products' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  <span>Product Sales & Margins</span>
                </Link>
                <Link
                  href="/admin/reports/customers"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/customers' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Customer & FIRST500</span>
                </Link>
                <Link
                  href="/admin/reports/procurement"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/procurement' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Procurement & Wastage</span>
                </Link>
                <Link
                  href="/admin/reports/suppliers"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/suppliers' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Suppliers & Mandi</span>
                </Link>
                <Link
                  href="/admin/reports/delivery"
                  onClick={() => setReportsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                    pathname === '/admin/reports/delivery' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Delivery & Driver COD</span>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/admin/procurement"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/procurement'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>8 PM Batches</span>
          </Link>

          <Link
            href="/admin/packing"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/packing'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Packing</span>
          </Link>

          <Link
            href="/admin/delivery"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/delivery'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Delivery</span>
          </Link>

          <Link
            href="/admin/pricing"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/pricing'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Pricing</span>
          </Link>

          <Link
            href="/admin/notifications"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/notifications'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Notifications</span>
          </Link>

          <Link
            href="/admin/staff"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/staff'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff</span>
          </Link>

          <Link
            href="/admin/settings"
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/admin/settings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Link>

          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-500 border border-slate-800 text-[10px] font-mono">
            v1.0.0
          </span>
        </div>

      </div>
    </div>
  );
}
