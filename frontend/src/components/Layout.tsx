import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "হোম", icon: "🏠", roles: ["officer"] },
  { to: "/transactions", label: "লেনদেন", icon: "🧾", roles: ["officer"] },
  { to: "/dealers", label: "ব্যবসায়ী", icon: "🏬", roles: ["officer"] },
  { to: "/ledger", label: "খাতা", icon: "📒", roles: ["officer"] },
  { to: "/officers", label: "কর্মকর্তা", icon: "👤", roles: ["officer", "admin"] },
];

const roleLabel = (role: string) => (role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা");

export default function Layout() {
  const { officer, logout } = useAuth();
  const navigate = useNavigate();

  const role = officer?.role ?? "officer";
  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-emerald-700 text-white shadow sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">SalesMaintain</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline opacity-90">
              {officer?.name} · {roleLabel(officer?.role ?? "")}
            </span>
            <button onClick={handleLogout} className="text-sm underline opacity-90 hover:opacity-100">
              লগআউট
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-30">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-[11px] ${
                isActive ? "text-emerald-700 font-semibold" : "text-slate-500"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Desktop side nav */}
      <aside className="hidden md:flex w-52 flex-col border-r border-slate-200 bg-white fixed inset-y-0 left-0 pt-16">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium ${
                isActive ? "bg-emerald-50 text-emerald-700 border-r-2 border-emerald-700" : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto px-5 py-4 text-xs text-slate-400">
          {officer?.name} · {roleLabel(officer?.role ?? "")}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-52 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

