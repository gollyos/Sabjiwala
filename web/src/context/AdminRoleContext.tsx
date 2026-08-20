'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type StaffRole = 'owner' | 'manager' | 'packing' | 'delivery';

const AdminRoleContext = createContext<StaffRole | null>(null);

export function AdminRoleProvider({ role, children }: { role: StaffRole; children: ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
  return useContext(AdminRoleContext);
}
