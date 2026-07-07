import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { DashboardBottomNav } from "./DashboardBottomNav";

export function Layout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <SubscriptionBanner />
          <main className="flex-1 p-3 sm:p-6 pb-20 md:pb-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <DashboardBottomNav />
    </SidebarProvider>
  );
}
