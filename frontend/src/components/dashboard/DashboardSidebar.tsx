import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Radio,
  CheckSquare,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Briefings", to: "/dashboard/briefings", icon: Radio },
  { label: "Tasks", to: "/dashboard/tasks", icon: CheckSquare },
  { label: "Integrations", to: "/dashboard/integrations", icon: Plug },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const { logout, email } = useAuth();
  const displayName = email ? email.split("@")[0] : "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 h-screen sticky top-0">
        <div className="p-6 flex items-center gap-2">
          <div className="flex items-end gap-[2px] h-5">
            {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
              <div key={i} className="w-[3px] rounded-full bg-primary" style={{ height: `${s * 100}%` }} />
            ))}
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Brief Buddy</span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-foreground font-medium border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:translate-x-1"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </RouterNavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{email ?? "Brief Buddy"}</p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border flex justify-around py-2">
        {navItems.slice(0, 4).map(item => {
          const active = location.pathname === item.to;
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </RouterNavLink>
          );
        })}
      </nav>
    </>
  );
};

export default DashboardSidebar;
