import { Suspense, lazy, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { ModuleGuard } from "@/components/ModuleGuard";
import { Layout } from "@/components/layout/Layout";
import { Loader2 } from "lucide-react";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { AppStateManager } from "@/components/AppStateManager";

// Retry wrapper for lazy imports – handles stale Vite HMR module URLs
function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch(
      () =>
        new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => {
            factory()
              .then(resolve)
              .catch((err) => {
                // Stale module URL after Vite/HMR restart — force a hard reload once.
                const key = "lovable-lazy-reload";
                if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
                  sessionStorage.setItem(key, "1");
                  window.location.reload();
                } else {
                  reject(err);
                }
              });
          }, 1500);
        }),
    ),
  );
}

// ── Public module (no auth) ──────────────────────────────────
const BookPublic = lazyRetry(() => import("./pages/BookPublic"));
const CenterDetail = lazyRetry(() => import("./pages/CenterDetail"));
const VenuePage = lazyRetry(() => import("./pages/VenuePage"));
const BookingSuccess = lazyRetry(() => import("./pages/BookingSuccess"));
const MyBookings = lazyRetry(() => import("./pages/MyBookings"));
const BookingDetail = lazyRetry(() => import("./pages/BookingDetail"));
const SubmitFeedback = lazyRetry(() => import("./pages/SubmitFeedback"));
const Trainers = lazyRetry(() => import("./pages/Trainers"));
const AcceptInvite = lazyRetry(() => import("./pages/AcceptInvite"));

// ── Center module (staff+) ──────────────────────────────────
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Resources = lazyRetry(() => import("./pages/Resources"));
const ResourceDetail = lazyRetry(() => import("./pages/ResourceDetail"));
const Sessions = lazyRetry(() => import("./pages/Sessions"));
const Bookings = lazyRetry(() => import("./pages/Bookings"));
const StaffBooking = lazyRetry(() => import("./pages/StaffBooking"));
const PlayoBooking = lazyRetry(() => import("./pages/PlayoBooking"));
const Customers = lazyRetry(() => import("./pages/Customers"));
const Payments = lazyRetry(() => import("./pages/Payments"));
const MarshalView = lazyRetry(() => import("./pages/MarshalView"));
const Reports = lazyRetry(() => import("./pages/Reports"));
const Analytics = lazyRetry(() => import("./pages/Analytics"));
const PricingRules = lazyRetry(() => import("./pages/PricingRules"));
const Expenses = lazyRetry(() => import("./pages/Expenses"));
const ApprovalPanel = lazyRetry(() => import("./pages/ApprovalPanel"));
const AuditLog = lazyRetry(() => import("./pages/AuditLog"));
const MonthlyPlans = lazyRetry(() => import("./pages/MonthlyPlans"));
const PaymentHistory = lazyRetry(() => import("./pages/PaymentHistory"));

// ── Admin module (super_admin / org_admin) ───────────────────
const Users = lazyRetry(() => import("./pages/Users"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Organization = lazyRetry(() => import("./pages/Organization"));
const SuperAdminLayout = lazyRetry(() => import("./pages/super-admin/SuperAdminLayout"));
const SAOverview = lazyRetry(() => import("./pages/super-admin/Overview"));
const SACenters = lazyRetry(() => import("./pages/super-admin/Centers"));
const SABulkImport = lazyRetry(() => import("./pages/super-admin/BulkImportPage"));
const SAUsers = lazyRetry(() => import("./pages/super-admin/UsersPage"));
const SAPlans = lazyRetry(() => import("./pages/super-admin/PlansPage"));
const SAMedia = lazyRetry(() => import("./pages/super-admin/MediaPage"));
const SASlugs = lazyRetry(() => import("./pages/super-admin/SlugsPage"));
const SAHomepage = lazyRetry(() => import("./pages/super-admin/HomepagePage"));
const SAFlags = lazyRetry(() => import("./pages/super-admin/FlagsPage"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
            <AppStateManager />
            <PwaInstallBanner />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Auth ─────────────────────────────────── */}
              <Route path="/login" element={<Login />} />

              {/* ── Public module (no login required) ───── */}
              <Route path="/" element={<BookPublic />} />
              <Route path="/easyslot-booking" element={<BookPublic />} />
              <Route path="/easyslot-booking/:param1" element={<BookPublic />} />
              <Route path="/easyslot-booking/:param1/:param2" element={<BookPublic />} />
              <Route path="/easyslot-booking/center/:centerId" element={<CenterDetail />} />
              <Route path="/venue/:slug" element={<VenuePage />} />
              <Route path="/:city/venue/:slug" element={<VenuePage />} />
              <Route path="/booking-success/:sessionId" element={<BookingSuccess />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/booking/:id" element={<BookingDetail />} />
              <Route path="/feedback/:sessionId" element={<SubmitFeedback />} />
              <Route path="/trainers" element={<Trainers />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              {/* Legacy redirect */}
              <Route path="/book/*" element={<Navigate to="/easyslot-booking" replace />} />

              {/* ── Onboarding (auth, no role yet) ──────── */}
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* ── Center module (auth + layout) ───────── */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/resources/:id" element={<ResourceDetail />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/staff-booking" element={<RoleGuard minRole="staff" fallback="forbidden"><StaffBooking /></RoleGuard>} />
                <Route path="/playo-booking" element={<RoleGuard minRole="staff" fallback="forbidden"><PlayoBooking /></RoleGuard>} />
                <Route path="/monthly-plans" element={<RoleGuard minRole="staff" fallback="forbidden"><ModuleGuard module="monthly_plans"><MonthlyPlans /></ModuleGuard></RoleGuard>} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/analytics" element={<RoleGuard minRole="staff" fallback="forbidden"><ModuleGuard module="analytics"><Analytics /></ModuleGuard></RoleGuard>} />
                <Route path="/marshal" element={<ModuleGuard module="marshal_view"><MarshalView /></ModuleGuard>} />
                <Route path="/reports" element={<RoleGuard minRole="staff" fallback="forbidden"><ModuleGuard module="reports"><Reports /></ModuleGuard></RoleGuard>} />
                <Route path="/approvals" element={<RoleGuard minRole="center_admin" fallback="forbidden"><ModuleGuard module="approvals"><ApprovalPanel /></ModuleGuard></RoleGuard>} />
                <Route path="/pricing" element={<RoleGuard minRole="center_admin" fallback="forbidden"><ModuleGuard module="pricing_rules"><PricingRules /></ModuleGuard></RoleGuard>} />
                <Route path="/audit-log" element={<RoleGuard minRole="center_admin" fallback="forbidden"><AuditLog /></RoleGuard>} />
                <Route path="/expenses" element={<RoleGuard minRole="center_admin" fallback="forbidden"><ModuleGuard module="expenses"><Expenses /></ModuleGuard></RoleGuard>} />
                <Route path="/payment-history" element={<RoleGuard minRole="center_admin" fallback="forbidden"><PaymentHistory /></RoleGuard>} />

                {/* ── Admin module (inside layout) ──────── */}
                <Route path="/users" element={<RoleGuard allowedRoles={["super_admin"]} fallback="forbidden"><Users /></RoleGuard>} />
                <Route path="/settings" element={<RoleGuard minRole="center_admin" fallback="forbidden"><Settings /></RoleGuard>} />
                <Route path="/organization" element={<RoleGuard minRole="organization_admin" fallback="forbidden"><Organization /></RoleGuard>} />
                <Route path="/super-admin" element={<RoleGuard allowedRoles={["super_admin"]} fallback="forbidden"><SuperAdminLayout /></RoleGuard>}>
                  <Route index element={<SAOverview />} />
                  <Route path="centers" element={<SACenters />} />
                  <Route path="bulk-import" element={<SABulkImport />} />
                  <Route path="users" element={<SAUsers />} />
                  <Route path="plans" element={<SAPlans />} />
                  <Route path="media" element={<SAMedia />} />
                  <Route path="slugs" element={<SASlugs />} />
                  <Route path="homepage" element={<SAHomepage />} />
                  <Route path="flags" element={<SAFlags />} />
                </Route>
              </Route>

              {/* ── 404 ─────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
