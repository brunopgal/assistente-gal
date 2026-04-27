import { NavLink, useLocation } from "react-router-dom";
import { Building2, Calendar, MapPin, Menu, X, PlusCircle, PhoneForwarded } from "lucide-react";
import { useState } from "react";
import SecretariaChat from "@/components/SecretariaChat";

const navItems = [
  { title: "Obras", path: "/", icon: Building2, iconClassName: "" },
  { title: "Follow-up", path: "/follow-up", icon: PhoneForwarded, iconClassName: "" },
  { title: "Agenda", path: "/agenda", icon: Calendar, iconClassName: "" },
  { title: "Maps", path: "/mapa", icon: MapPin, iconClassName: "text-[#EA4335] fill-[#EA4335]" },
  { title: "Nova Obra", path: "/nova-obra", icon: PlusCircle, iconClassName: "" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-nav text-nav-foreground sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14 md:h-16">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-nav-active" />
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Painel de Obras
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-nav-active text-primary-foreground shadow-md"
                      : "text-nav-foreground hover:bg-nav-active/10"
                  }`
                }
              >
                <item.icon className={`h-4 w-4 ${item.iconClassName}`} />

                {item.title}
              </NavLink>
            ))}
          </nav>

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
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-nav-active text-primary-foreground"
                      : "text-nav-foreground hover:bg-nav-active/10"
                  }`
                }
              >
                <item.icon className={`h-4 w-4 ${item.iconClassName}`} />
                {item.title}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Floating AI Secretary */}
      <SecretariaChat />
    </div>
  );
}
