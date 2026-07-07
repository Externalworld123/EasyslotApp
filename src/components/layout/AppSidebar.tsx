import { LayoutDashboard, Clock, Settings, Users, Tv2, FileBarChart, Eye, CreditCard, CheckSquare, Building2, UserRound, TrendingUp, ScrollText, BarChart3, Receipt, CalendarCheck, Zap, Shield, CalendarRange, Lock, Grid3x3 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isOrgAdmin, canManage, isSuperAdmin, canWrite } from "@/lib/auth";
import { useSubscription, ModuleKey } from "@/hooks/useSubscription";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Courts", url: "/resources", icon: Tv2 },
  { title: "Sessions", url: "/sessions", icon: Clock },
  { title: "Bookings", url: "/bookings", icon: CalendarCheck },
  { title: "Slot Booking", url: "/playo-booking", icon: Grid3x3, minRole: "staff" as const },
  { title: "Monthly Plans", url: "/monthly-plans", icon: CalendarRange, minRole: "staff" as const, module: "monthly_plans" as ModuleKey },
  { title: "Customers", url: "/customers", icon: UserRound },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Analytics", url: "/analytics", icon: BarChart3, module: "analytics" as ModuleKey },
  { title: "Reports", url: "/reports", icon: FileBarChart, module: "reports" as ModuleKey },
  { title: "Marshal View", url: "/marshal", icon: Eye, module: "marshal_view" as ModuleKey },
];

const adminNav = [
  { title: "Payment History", url: "/payment-history", icon: CreditCard, minRole: "center_admin" as const },
  { title: "Approvals", url: "/approvals", icon: CheckSquare, minRole: "center_admin" as const, module: "approvals" as ModuleKey },
  { title: "Pricing Rules", url: "/pricing", icon: TrendingUp, minRole: "center_admin" as const, module: "pricing_rules" as ModuleKey },
  { title: "Expenses", url: "/expenses", icon: Receipt, minRole: "center_admin" as const, module: "expenses" as ModuleKey },
  { title: "Audit Log", url: "/audit-log", icon: ScrollText, minRole: "center_admin" as const },
  { title: "Users", url: "/users", icon: Users, minRole: "center_admin" as const },
  { title: "Settings", url: "/settings", icon: Settings, minRole: "center_admin" as const },
  { title: "Organization", url: "/organization", icon: Building2, minRole: "organization_admin" as const },
  { title: "Super Admin", url: "/super-admin", icon: Shield, minRole: "super_admin" as const },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { primaryRole } = useAuth();
  const { data: subscription } = useSubscription();

  // Filter main nav based on role
  const visibleMainNav = mainNav.filter((item) => {
    if (!("minRole" in item)) return true;
    return canWrite(primaryRole);
  });

  // Filter admin nav based on role
  const visibleAdminNav = adminNav.filter((item) => {
    if (item.minRole === "super_admin") return isSuperAdmin(primaryRole);
    if (item.minRole === "organization_admin") return isOrgAdmin(primaryRole);
    return canManage(primaryRole);
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Clock className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">EasySlot</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => {
                const locked = item.module && subscription?.moduleAccess?.[item.module] === false;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          cn("hover:bg-sidebar-accent/50", isActive && "bg-sidebar-accent text-sidebar-primary font-medium", locked && "opacity-50")
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {!collapsed && locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdminNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminNav.map((item) => {
                  const locked = item.module && subscription?.moduleAccess?.[item.module] === false;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className={({ isActive }) =>
                            cn("hover:bg-sidebar-accent/50", isActive && "bg-sidebar-accent text-sidebar-primary font-medium", locked && "opacity-50")
                          }
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {!collapsed && locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
