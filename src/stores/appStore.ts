import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole, UserRole } from "@/lib/auth";

/**
 * Global app store (Zustand).
 *
 * Holds cross-page state that should NOT be re-fetched on every navigation:
 *  - Auth (session/user/roles) — mirrored from AuthContext
 *  - Active session/booking the staff is currently working on
 *  - Transient UI state (expanded plan card, open modals)
 *
 * Auth slice is in-memory only (Supabase already persists the session).
 * Active-session + UI slices persist to localStorage so they survive reloads
 * and app backgrounding.
 */

// ── Auth slice (in-memory) ──────────────────────────────────
interface AuthSlice {
  session: Session | null;
  user: User | null;
  roles: UserRole[];
  primaryRole: AppRole | null;
  centerId: string | null;
  authLoading: boolean;
  rolesLoading: boolean;
  setAuth: (s: {
    session: Session | null;
    user: User | null;
    authLoading?: boolean;
  }) => void;
  setRoles: (s: {
    roles: UserRole[];
    primaryRole: AppRole | null;
    centerId: string | null;
    rolesLoading?: boolean;
  }) => void;
  clearAuth: () => void;
}

// ── Active session slice (persisted) ────────────────────────
export interface ActiveSessionRef {
  id: string;
  resourceId: string;
  customerName: string;
  startedAt: string; // ISO
}

interface ActiveSessionSlice {
  activeSession: ActiveSessionRef | null;
  setActiveSession: (s: ActiveSessionRef | null) => void;
}

// ── UI slice (persisted) ────────────────────────────────────
interface UISlice {
  expandedPlanIds: string[];
  setExpandedPlan: (id: string, expanded: boolean) => void;
  openModal: string | null;
  setOpenModal: (id: string | null) => void;
}

type AppState = AuthSlice & ActiveSessionSlice & UISlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      session: null,
      user: null,
      roles: [],
      primaryRole: null,
      centerId: null,
      authLoading: true,
      rolesLoading: true,
      setAuth: ({ session, user, authLoading }) =>
        set({
          session,
          user,
          ...(authLoading !== undefined ? { authLoading } : {}),
        }),
      setRoles: ({ roles, primaryRole, centerId, rolesLoading }) =>
        set({
          roles,
          primaryRole,
          centerId,
          ...(rolesLoading !== undefined ? { rolesLoading } : {}),
        }),
      clearAuth: () =>
        set({
          session: null,
          user: null,
          roles: [],
          primaryRole: null,
          centerId: null,
          authLoading: false,
          rolesLoading: false,
          activeSession: null,
        }),

      // Active session
      activeSession: null,
      setActiveSession: (s) => set({ activeSession: s }),

      // UI
      expandedPlanIds: [],
      setExpandedPlan: (id, expanded) => {
        const cur = get().expandedPlanIds;
        const next = expanded
          ? Array.from(new Set([...cur, id]))
          : cur.filter((x) => x !== id);
        set({ expandedPlanIds: next });
      },
      openModal: null,
      setOpenModal: (id) => set({ openModal: id }),
    }),
    {
      name: "easyslot_app_store",
      storage: createJSONStorage(() => localStorage),
      // Only persist non-auth state. Supabase manages its own session storage.
      partialize: (state) => ({
        activeSession: state.activeSession,
        expandedPlanIds: state.expandedPlanIds,
      }),
    },
  ),
);

// Convenience selectors
export const selectUser = (s: AppState) => s.user;
export const selectPrimaryRole = (s: AppState) => s.primaryRole;
export const selectCenterId = (s: AppState) => s.centerId;
export const selectActiveSession = (s: AppState) => s.activeSession;
