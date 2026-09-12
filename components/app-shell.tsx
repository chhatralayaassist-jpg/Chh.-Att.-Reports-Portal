import { PORTAL_VERIFIED_KEY } from "@/lib/portal-session";
const appLogo = { url: "/favicon.png" };
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  Users,
  ScanLine,
  ClipboardList,
  CalendarDays,
  Sheet as SheetIcon,
  Settings as SettingsIcon,
  FileText,
  MailCheck,
  MessageSquare,
  Bell,
  History,
  DoorOpen,
  BarChart3,
  TrendingUp,
  LayoutGrid,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyProfile, useMyRoles, type AppRole } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type NavItem = { title: string; url: string; icon: any; roles?: AppRole[] };

const NAV: NavItem[] = [
  { title: "Notice", url: "/notices", icon: Bell },
  { title: "Take Attendance", url: "/attendance", icon: ScanLine, roles: ["admin", "attendance_taker"] },
  { title: "Students", url: "/students", icon: Users, roles: ["admin"] },
  { title: "Daily Register", url: "/daily", icon: ClipboardList, roles: ["admin", "rector"] },
  { title: "Google Sheets", url: "/sheets", icon: SheetIcon, roles: ["admin"] },
  { title: "Daily Attendance Report", url: "/group-report", icon: ClipboardList, roles: ["admin", "group_leader", "attendance_taker"] },
  { title: "Attendance Slip", url: "/slip", icon: FileText, roles: ["admin", "group_leader"] },
  { title: "Attendance Slip Requests", url: "/slip-requests", icon: MailCheck, roles: ["admin", "rector", "group_leader"] },
  { title: "Attendance Slips History", url: "/slip-history", icon: History, roles: ["admin"] },
  { title: "Leave Slip", url: "/leave-slip", icon: CalendarDays, roles: ["admin", "group_leader"] },
  { title: "Leave Slip Requests", url: "/leave-slip-requests", icon: MailCheck, roles: ["admin", "rector", "group_leader"] },
  { title: "Attendance Leave Slips History", url: "/leave-slip-history", icon: History, roles: ["admin"] },
  { title: "Gate Pass", url: "/gate-pass", icon: DoorOpen, roles: ["admin", "group_leader"] },
  { title: "Gate Pass Requests", url: "/gate-pass-requests", icon: MailCheck, roles: ["admin", "rector"] },
  { title: "Gate Pass History", url: "/gate-pass-history", icon: History, roles: ["admin"] },
  { title: "Monthly Leave Report", url: "/leave-report", icon: CalendarDays, roles: ["admin", "rector"] },
  { title: "Dec Day 1", url: "/dec-day-1", icon: BarChart3, roles: ["admin", "rector"] },
  { title: "Dec Day 2", url: "/dec-day-2", icon: BarChart3, roles: ["admin", "rector"] },
  { title: "Monthly Report", url: "/monthly-report", icon: BarChart3, roles: ["admin", "rector"] },
  { title: "Performance Report", url: "/performance-report", icon: TrendingUp, roles: ["admin", "rector"] },
  { title: "Group Wise Summary Report", url: "/group-summary", icon: Users, roles: ["admin", "rector"] },
  { title: "Schedule Wise Attendance", url: "/schedule-wise", icon: LayoutGrid, roles: ["admin", "rector"] },
  { title: "Q & A", url: "/qa", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: SettingsIcon, roles: ["admin"] },
];



function roleLabel(r: AppRole) {
  return r === "attendance_taker" ? "Attendance Taker" : r === "admin" ? "Admin" : r === "group_leader" ? "Group Leader" : "Rector";
}

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useMyRoles();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const visible = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    localStorage.removeItem(PORTAL_VERIFIED_KEY);
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src={appLogo.url}
            alt="Chhatralaya Attendance logo"
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />

          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">Chhatralaya</span>
            <span className="text-xs text-sidebar-foreground/60">Attendance</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url || path.startsWith(item.url + "/")}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name ?? profile?.email}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px]">{roleLabel(r)}</Badge>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useTheme();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="font-semibold text-foreground">Chhatralaya Attendance</div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
