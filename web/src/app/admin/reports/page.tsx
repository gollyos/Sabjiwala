'use client';

import React from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  Users, 
  Boxes, 
  Truck, 
  DollarSign, 
  Building2, 
  ArrowRight,
  BarChart3,
  Scale,
  Sparkles
} from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function ReportsHubPage() {
  const reportCategories = [
    {
      title: 'Sales & Financials (વેચાણ અને આવક)',
      desc: 'Daily, weekly, and monthly net sales turnover, gross vs discounts, and revenue trends.',
      href: '/admin/reports/sales',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      badge: 'Core Financials',
    },
    {
      title: 'Orders Audit (ઓર્ડર્સ રિપોર્ટ)',
      desc: 'Complete historical order snapshots, delivery addresses, payment types, and fulfilment rates.',
      href: '/admin/reports/orders',
      icon: ShoppingBag,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      badge: 'Ledger',
    },
    {
      title: 'Product Performance & Margins (શાકભાજી નફો)',
      desc: 'Volume demanded by vegetable, gross revenue contribution, sorting losses, and product-level margins.',
      href: '/admin/reports/products',
      icon: Package,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
      badge: 'Margins',
    },
    {
      title: 'Customer Insights & FIRST500 (ગ્રાહક એનાલિટિક્સ)',
      desc: 'Active household customers, FIRST500 cohort conversion, repeat order frequencies in Halol.',
      href: '/admin/reports/customers',
      icon: Users,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      badge: 'Retention',
    },
    {
      title: 'Procurement & Wastage (ખરીદી અને બગાડ)',
      desc: 'APMC mandi procurement quantities vs received weights, sort wastage percentage, and buffer efficiency.',
      href: '/admin/reports/procurement',
      icon: Boxes,
      color: 'text-teal-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
      badge: 'Godown Quality',
    },
    {
      title: 'Delivery & Fleet Audits (ડિલિવરી કામગીરી)',
      desc: 'Driver completion timelines, on-time morning delivery success rates, and Halol route performance.',
      href: '/admin/reports/delivery',
      icon: Truck,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
      badge: 'Logistics',
    },
    {
      title: 'Suppliers & Mandi Traders (સપ્લાયર્સ)',
      desc: 'APMC trader lot histories, mandi rates per kg, total payable balances, and supplier reliability.',
      href: '/admin/reports/suppliers',
      icon: Building2,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
      badge: 'Vendors',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Hub Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <BarChart3 className="w-4 h-4" />
            <span>Business Reports & Audits (બિઝનેસ રિપોર્ટ્સ)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Analytics & Operations Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Select a specialized report category below to view detailed charts, filter historical data, and export official spreadsheets.
          </p>
        </div>

        {/* 8 Clickable Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reportCategories.map((cat, idx) => {
            const Icon = cat.icon;

            return (
              <Link
                key={idx}
                href={cat.href}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl ${cat.bgColor} ${cat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {cat.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>View Report</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

      </main>
    </div>
  );
}
