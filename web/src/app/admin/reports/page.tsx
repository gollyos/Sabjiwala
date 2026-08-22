'use client';

import Link from 'next/link';
import { TrendingUp, ShoppingBag, Package, Users, Boxes, Truck, Building2, BarChart3, ArrowRight } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function ReportsHubPage() {
  const reportCategories = [
    {
      title: 'Sales & Financials',
      titleGu: 'વેચાણ અને આવક રિપોર્ટ',
      desc: 'Daily, weekly, and monthly net sales turnover, gross revenue, discounts, and profitability margin waterfalls.',
      href: '/admin/reports/sales',
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-emerald-700',
      shadowColor: 'shadow-emerald-500/25',
      badge: 'Core Financials',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      accentColor: 'text-emerald-700 group-hover:text-emerald-800',
    },
    {
      title: 'Orders Audit',
      titleGu: 'ઓર્ડર્સ ઓડિટ રિપોર્ટ',
      desc: 'Complete historical order snapshots, delivery addresses, payment modes, item quantities, and status breakdown.',
      href: '/admin/reports/orders',
      icon: ShoppingBag,
      gradient: 'from-blue-600 to-indigo-600',
      shadowColor: 'shadow-blue-500/25',
      badge: 'Order Ledger',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      accentColor: 'text-blue-700 group-hover:text-blue-800',
    },
    {
      title: 'Product Performance & Margins',
      titleGu: 'શાકભાજી અને ફળો નફો',
      desc: 'Volume demanded per vegetable/fruit, gross revenue contribution, realized sell rates vs mandi cost, and unit margins.',
      href: '/admin/reports/products',
      icon: Package,
      gradient: 'from-purple-600 to-violet-600',
      shadowColor: 'shadow-purple-500/25',
      badge: 'Margins & Profit',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
      accentColor: 'text-purple-700 group-hover:text-purple-800',
    },
    {
      title: 'Customer Insights & FIRST500',
      titleGu: 'ગ્રાહક એનાલિટિક્સ અને ઑફર',
      desc: 'Halol customer cohort retention, verified sequence numbers, lifetime spend, and strict FIRST500 quota tracking.',
      href: '/admin/reports/customers',
      icon: Users,
      gradient: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-amber-500/25',
      badge: 'Customer Cohorts',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      accentColor: 'text-amber-700 group-hover:text-amber-800',
    },
    {
      title: 'Procurement & Wastage',
      titleGu: 'ખરીદી, વજન અને બગાડ',
      desc: '8 PM batch frozen demand vs actual mandi purchases, receiving weights, usable sorting quantities, and wastage costs.',
      href: '/admin/reports/procurement',
      icon: Boxes,
      gradient: 'from-teal-600 to-emerald-600',
      shadowColor: 'shadow-teal-500/25',
      badge: 'Godown Quality',
      badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
      accentColor: 'text-teal-700 group-hover:text-teal-800',
    },
    {
      title: 'Delivery & Fleet Audits',
      titleGu: 'ડિલિવરી અને રોકડ હિસાબ',
      desc: 'Driver completion timelines, on-time morning delivery success rates, Halol neighborhood routes, and cash settlement.',
      href: '/admin/reports/delivery',
      icon: Truck,
      gradient: 'from-cyan-600 to-blue-600',
      shadowColor: 'shadow-cyan-500/25',
      badge: 'Fleet & Logistics',
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      accentColor: 'text-cyan-700 group-hover:text-cyan-800',
    },
    {
      title: 'Suppliers & Mandi Traders',
      titleGu: 'વેપારી અને APMC હિસાબ',
      desc: 'APMC trader lot histories, mandi purchase rates per kg, total payable balances, and vendor quality reliability.',
      href: '/admin/reports/suppliers',
      icon: Building2,
      gradient: 'from-rose-500 to-pink-600',
      shadowColor: 'shadow-rose-500/25',
      badge: 'Mandi Vendors',
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
      accentColor: 'text-rose-700 group-hover:text-rose-800',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Hub Header */}
        <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <BarChart3 className="w-4 h-4" />
              <span>Business Reports &amp; Audits (બિઝનેસ રિપોર્ટ્સ)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Analytics &amp; Operations Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Real-time financial ledgers, product profitability margins, mandi procurement wastage audits, and Excel exports for TaazaTokra Halol operations.
            </p>
          </div>
        </div>

        {/* 7 Clickable Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reportCategories.map((cat, idx) => {
            const Icon = cat.icon;

            return (
              <Link
                key={idx}
                href={cat.href}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cat.gradient} text-white flex items-center justify-center shadow-md ${cat.shadowColor} group-hover:scale-105 transition-transform duration-200`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${cat.badgeColor}`}>
                      {cat.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base tracking-tight group-hover:text-emerald-700 transition-colors flex flex-col">
                      <span>{cat.title}</span>
                      <span className="text-xs font-bold text-slate-500 mt-0.5 font-sans">
                        ({cat.titleGu})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className={cat.accentColor}>રિપોર્ટ જુઓ (View Report)</span>
                  <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </main>
    </div>
  );
}

