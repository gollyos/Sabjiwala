'use client';

import { getErrorMessage } from '@/lib/errors';
import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, RefreshCw, Shield, CheckCircle2, XCircle, Edit3, AlertCircle, X } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

interface StaffUser {
  id: string;
  full_name: string;
  mobile: string;
  is_active: boolean;
  role: string;
  created_at: string;
  updated_at: string;
}

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  // Form states
  const [formFullName, setFormFullName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formRole, setFormRole] = useState<'manager' | 'packing' | 'delivery'>('packing');
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/staff');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch staff list');
      }

      setStaffList(json.staff || []);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleOpenAddModal = () => {
    setFormFullName('');
    setFormMobile('');
    setFormRole('packing');
    setFormActive(true);
    setEditingStaff(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (staff: StaffUser) => {
    setFormFullName(staff.full_name);
    setFormMobile(staff.mobile);
    setFormRole(staff.role as any);
    setFormActive(staff.is_active);
    setEditingStaff(staff);
    setShowAddModal(true);
  };

  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const endpoint = '/api/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      const payload = {
        user_id: editingStaff?.id,
        full_name: formFullName,
        mobile: formMobile,
        role: formRole,
        is_active: formActive,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Operation failed');
      }

      setSuccessMsg(editingStaff ? 'Staff updated successfully' : 'Staff created successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowAddModal(false);
      await fetchStaff();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error saving staff');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px] uppercase tracking-wider">Owner (માલિક)</span>;
      case 'manager':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-bold text-[10px] uppercase tracking-wider">Manager (મેનેજર)</span>;
      case 'packing':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px] uppercase tracking-wider">Packing Staff (પેકિંગ સ્ટાફ)</span>;
      case 'delivery':
        return <span className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full font-bold text-[10px] uppercase tracking-wider">Delivery Staff (ડિલિવરી સ્ટાફ)</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-bold text-[10px] uppercase tracking-wider">{role}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-3xl shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-600" />
              <span>Staff &amp; Role Management (સ્ટાફ સંચાલન)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Owner-controlled staff delegation for Godown Packing, Delivery Drivers, and Operations Managers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs rounded-2xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>

            <button
              type="button"
              onClick={fetchStaff}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Staff Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Active Staff Directory</h2>
            <span className="text-xs text-slate-500 font-mono font-bold">Total Staff: {staffList.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Staff Name</th>
                  <th className="px-5 py-3.5">Mobile Number</th>
                  <th className="px-5 py-3.5">Assigned Role</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5">Added Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xs font-black text-emerald-700">
                        {staff.full_name?.charAt(0) || 'S'}
                      </div>
                      <span>{staff.full_name}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600 font-bold">{staff.mobile}</td>
                    <td className="px-5 py-4">{getRoleBadge(staff.role)}</td>
                    <td className="px-5 py-4">
                      {staff.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Deactivated</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium">
                      {new Date(staff.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {staff.role === 'owner' ? (
                        <span className="text-[11px] text-slate-400 font-medium italic">Protected</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(staff)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add or Edit Staff */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <span>{editingStaff ? 'Edit Staff Account' : 'Add New Staff Member'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitStaff} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase text-[10px]">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase text-[10px]">Mobile Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210 or +919876543210"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold uppercase text-[10px]">Operational Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none"
                  >
                    <option value="packing">Packing Staff (Godown Bag Verification &amp; Printing)</option>
                    <option value="delivery">Delivery Staff (Driver Route, Bag Scan &amp; COD)</option>
                    <option value="manager">Manager (Operations, Purchasing, Catalog)</option>
                  </select>
                </div>

                {editingStaff && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div>
                      <div className="font-bold text-slate-900">Active Status</div>
                      <div className="text-[10px] text-slate-500">Deactivated staff immediately lose system access</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingStaff ? 'Save Changes' : 'Create Staff Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
