import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { DashboardBottomNav } from "./DashboardBottomNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          <AppHeader />
          <SubscriptionBanner />

          <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
      </div>
      <DashboardBottomNav />
    </SidebarProvider>
  );
}
