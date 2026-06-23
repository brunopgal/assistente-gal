import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Building,
  Calendar,
  MapPin,
  Menu,
  X,
  PhoneForwarded,
  CalendarClock,
  LogOut,
  Sparkles,
  Users,
  LayoutDashboard,
  FileBarChart,
  Bot,
  Target,
  ChevronDown,
  ChevronRight,
  ListChecks,
  FileText,
  Settings,
  Presentation,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Nav structure ────────────────────────────────────────────────────────────

type NavItem = { title: string; path: string; icon: React.ElementType; iconClassName?: string };
type NavGroup = { title: string; icon: React.ElementType; items: NavItem[] };
type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; group: NavGroup };

const navStructure: NavEntry[] = [
  {
    kind: "item",
    item: { title: "Dashboard", path: "/", icon: LayoutDashboard },
  },
  {
    kind: "group",
    group: {
      title: "Cadastros",
      icon: Building,
      items: [
        { title: "Obras", path: "/obras", icon: Building2 },
        { title: "Construtoras", path: "/construtoras", icon: Building },
        { title: "Contatos", path: "/pessoas", icon: Users },
        { title: "Relatórios", path: "/relatorios", icon: FileBarChart },
      ],
    },
  },
  {
    kind: "item",
    item: { title: "Mapa", path: "/mapa", icon: MapPin, iconClassName: "text-[#EA4335] fill-[#EA4335]" },
  },
  {
    kind: "group",
    group: {
      title: "Prospecção",
      icon: Target,
      items: [
        { title: "Prospecção", path: "/prospeccao", icon: Target, iconClassName: "text-primary" },
        { title: "Orçamentos", path: "/orcamentos", icon: FileText, iconClassName: "text-blue-500" },
        { title: "Apresentação", path: "/apresentacao", icon: Presentation, iconClassName: "text-indigo-500" },
        { title: "Prospecção IA", path: "/prospeccao-ia", icon: Sparkles },
        { title: "Configurações", path: "/configuracoes", icon: Settings },
      ],
    },
  },
  {
    kind: "group",
    group: {
      title: "Agenda",
      icon: Calendar,
      items: [
        { title: "Follow-up", path: "/follow-up", icon: PhoneForwarded },
        { title: "Agenda", path: "/agenda", icon: Calendar },
        { title: "Atividades Gerais", path: "/atividades-gerais", icon: ListChecks },
      ],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupHasActivePath(group: NavGroup, pathname: string): boolean {
  return group.items.some((i) =>
    i.path === "/" ? pathname === "/" : pathname.startsWith(i.path)
  );
}

const activeCls = "bg-nav-active text-primary-foreground shadow-md";
const inactiveCls = "text-nav-foreground hover:bg-nav-active/10";
const baseCls = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all";

// ── Desktop: single item ─────────────────────────────────────────────────────

function DesktopNavItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) => `${baseCls} ${isActive ? activeCls : inactiveCls}`}
    >
      <item.icon className={`h-4 w-4 ${item.iconClassName ?? ""}`} />
      {item.title}
    </NavLink>
  );
}

// ── Desktop: dropdown group ──────────────────────────────────────────────────

function DesktopNavGroup({ group }: { group: NavGroup }) {
  const { pathname } = useLocation();
  const isGroupActive = groupHasActivePath(group, pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`${baseCls} ${isGroupActive ? activeCls : inactiveCls} select-none outline-none`}
        >
          <group.icon className="h-4 w-4" />
          {group.title}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[170px] z-50"
      >
        {group.items.map((item) => {
          const isActive =
            item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          return (
            <DropdownMenuItem key={item.path} asChild>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-nav-active/15 text-nav-active font-medium"
                    : "hover:bg-accent"
                }`}
              >
                <item.icon className={`h-4 w-4 ${item.iconClassName ?? ""}`} />
                {item.title}
              </NavLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Mobile: single item ──────────────────────────────────────────────────────

function MobileNavItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive ? "bg-nav-active text-primary-foreground" : "text-nav-foreground hover:bg-nav-active/10"
        }`
      }
    >
      <item.icon className={`h-4 w-4 ${item.iconClassName ?? ""}`} />
      {item.title}
    </NavLink>
  );
}

// ── Mobile: collapsible group ────────────────────────────────────────────────

function MobileNavGroup({ group, onClose }: { group: NavGroup; onClose: () => void }) {
  const { pathname } = useLocation();
  const isGroupActive = groupHasActivePath(group, pathname);
  const [open, setOpen] = useState(isGroupActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isGroupActive
            ? "bg-nav-active/15 text-nav-active"
            : "text-nav-foreground hover:bg-nav-active/10"
        }`}
      >
        <group.icon className="h-4 w-4" />
        <span className="flex-1 text-left">{group.title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-nav-active/20 pl-3">
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-nav-active text-primary-foreground"
                    : "text-nav-foreground hover:bg-nav-active/10"
                }`
              }
            >
              <item.icon className={`h-4 w-4 ${item.iconClassName ?? ""}`} />
              {item.title}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate("/auth", { replace: true });
  }

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-nav text-nav-foreground sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-nav-active" />
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Painel de Obras
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1 items-center">
            {navStructure.map((entry, idx) =>
              entry.kind === "item" ? (
                <DesktopNavItem key={entry.item.path} item={entry.item} />
              ) : (
                <DesktopNavGroup key={entry.group.title + idx} group={entry.group} />
              )
            )}
          </nav>

          {/* Desktop logout */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-nav-foreground hover:bg-nav-active/10 transition"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-nav-active/10 transition"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-nav-active/10 px-4 pb-3 pt-1 flex flex-col gap-1">
            {navStructure.map((entry, idx) =>
              entry.kind === "item" ? (
                <MobileNavItem key={entry.item.path} item={entry.item} onClose={closeMobile} />
              ) : (
                <MobileNavGroup key={entry.group.title + idx} group={entry.group} onClose={closeMobile} />
              )
            )}
            <button
              onClick={() => { closeMobile(); handleLogout(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-nav-foreground hover:bg-nav-active/10 transition text-left mt-1"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
