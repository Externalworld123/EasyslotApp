import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Plus, Users, CreditCard, Image as ImageIcon,
  Link2, Home, Flag, Shield, Menu, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SA_SECTIONS = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, end: true, desc: "Platform metrics" },
  { to: "/super-admin/centers", label: "Centers", icon: Building2, desc: "Manage venues" },
  { to: "/super-admin/bulk-import", label: "Bulk Import", icon: Plus, desc: "Import via CSV" },
  { to: "/super-admin/users", label: "Users", icon: Users, desc: "Roles & access" },
  { to: "/super-admin/plans", label: "Plans", icon: CreditCard, desc: "Pricing tiers" },
  { to: "/super-admin/media", label: "Media", icon: ImageIcon, desc: "Images library" },
  { to: "/super-admin/slugs", label: "URL Slugs", icon: Link2, desc: "Public venue URLs" },
  { to: "/super-admin/homepage", label: "Homepage", icon: Home, desc: "Public homepage blocks" },
  { to: "/super-admin/flags", label: "Feature Flags", icon: Flag, desc: "Toggle features" },
];

function NavList({ onSelect }: { onSelect?: () => void }) {
  return (
    <nav className="p-2 space-y-1">
      {SA_SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.end}
          onClick={onSelect}
          className={({ isActive }) =>
            cn(
              "w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate leading-tight">{s.label}</span>
                <span className="block text-[11px] font-normal text-muted-foreground truncate md:hidden">
                  {s.desc}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 md:hidden" />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function SuperAdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = SA_SECTIONS.find((s) =>
    s.end ? location.pathname === s.to : location.pathname.startsWith(s.to),
  ) ?? SA_SECTIONS[0];

  return (
    <div className="flex gap-0 -mx-4 -mt-4 min-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-border bg-card/50 sticky top-0 h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">CMS Panel</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Platform Management</p>
        </div>
        <NavList />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Mobile sticky header with menu */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3 py-2.5">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="p-4 border-b border-border text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  CMS Panel
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground">Platform Management</p>
              </SheetHeader>
              <NavList onSelect={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex items-center gap-2">
            <current.icon className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-sm text-foreground truncate">{current.label}</span>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
