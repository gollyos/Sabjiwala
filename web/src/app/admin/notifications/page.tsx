'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  Search, 
  RefreshCw, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCw, 
  MessageSquare, 
  Filter, 
  Smartphone,
  Eye,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';

export default function AdminNotificationCenterPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (search) params.set('search', search);
      params.set('limit', '50');

      const res = await fetch(`/api/notifications/queue?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch notification queue');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading notifications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleProcessQueue = async () => {
    try {
      setProcessing(true);
      const res = await fetch('/api/notifications/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Processing failed');
      await fetchQueue();
    } catch (err: any) {
      alert(`Worker error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch('/api/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Retry failed');
      await fetchQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryAllFailed = async () => {
    if (!confirm('Are you sure you want to retry all failed notification jobs?')) return;
    try {
      const res = await fetch('/api/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retry_all_failed: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Retry all failed');
      await fetchQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const counts = data?.counts || { total: 0, queued: 0, processing: 0, sent: 0, failed: 0 };
  const jobs: any[] = data?.jobs || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-400" />
              <span>WhatsApp Notification Center (સૂચના કેન્દ્ર)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live transactional outbox, Meta Cloud API delivery receipts, and automated 8 PM procurement dispatches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProcessQueue}
              disabled={processing || counts.queued === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
              <span>{processing ? 'Processing...' : `Process Outbox (${counts.queued})`}</span>
            </button>

            {counts.failed > 0 && (
              <button
                type="button"
                onClick={handleRetryAllFailed}
                className="px-4 py-2 bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Failed ({counts.failed})</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchQueue}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div 
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              statusFilter === 'all' ? 'bg-slate-800 border-emerald-500 shadow-lg' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Dispatches</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{counts.total}</div>
          </div>

          <div 
            onClick={() => setStatusFilter('queued')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              statusFilter === 'queued' ? 'bg-slate-800 border-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Queued</span>
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">{counts.queued}</div>
          </div>

          <div 
            onClick={() => setStatusFilter('processing')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              statusFilter === 'processing' ? 'bg-slate-800 border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              <span>Processing</span>
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">{counts.processing}</div>
          </div>

          <div 
            onClick={() => setStatusFilter('sent')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              statusFilter === 'sent' ? 'bg-slate-800 border-emerald-500 shadow-lg' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Sent</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{counts.sent}</div>
          </div>

          <div 
            onClick={() => setStatusFilter('failed')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              statusFilter === 'failed' ? 'bg-slate-800 border-red-500 shadow-lg' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>Failed</span>
            </div>
            <div className="text-2xl font-black text-red-400 font-mono mt-1">{counts.failed}</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Filter by Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="all">All Types</option>
              <option value="ORDER_CONFIRMED">ORDER_CONFIRMED</option>
              <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
              <option value="ORDER_DELIVERED">ORDER_DELIVERED</option>
              <option value="DELIVERY_FAILED">DELIVERY_FAILED</option>
              <option value="PROCUREMENT_BATCH_LOCKED">PROCUREMENT_BATCH_LOCKED (8 PM)</option>
              <option value="PACKING_PROBLEM">PACKING_PROBLEM</option>
              <option value="COD_DISCREPANCY">COD_DISCREPANCY</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Search Queue</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search mobile, order number, key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Selected Job Drawer */}
        {selectedJob && (
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="font-extrabold text-sm text-white">
                  Job Inspector: {selectedJob.idempotency_key}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  selectedJob.status === 'sent' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400'
                }`}>
                  {selectedJob.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Recipient</span>
                <div className="font-mono font-bold text-white mt-1">{selectedJob.recipient}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">WhatsApp Message ID</span>
                <div className="font-mono text-emerald-400 mt-1 truncate">{selectedJob.whatsapp_message_id || 'Not dispatched'}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Retries & Schedule</span>
                <div className="font-mono text-slate-300 mt-1">
                  Attempt {selectedJob.retry_count} / {selectedJob.max_retries}
                </div>
              </div>
            </div>

            {selectedJob.last_error && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-2xl text-xs text-red-400">
                <span className="font-bold">Last Error:</span> {selectedJob.last_error}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Payload Data</span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleRetryJob(selectedJob.id)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry this Job</span>
              </button>
            </div>
          </div>
        )}

        {/* Jobs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Notification Outbox Queue</span>
            <span>{jobs.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Template</th>
                  <th className="p-3.5 text-center">Retries</th>
                  <th className="p-3.5">Enqueued At</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        job.status === 'sent'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : job.status === 'failed'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : job.status === 'processing'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-white">{job.notification_type}</td>
                    <td className="p-3.5 text-slate-300 flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-slate-500" />
                      <span>{job.recipient}</span>
                    </td>
                    <td className="p-3.5 text-slate-400">{job.template_key}</td>
                    <td className="p-3.5 text-center text-slate-400">
                      {job.retry_count} / {job.max_retries}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(job.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Inspect
                      </button>
                      {job.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryJob(job.id)}
                          className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No notifications found in this filter range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
