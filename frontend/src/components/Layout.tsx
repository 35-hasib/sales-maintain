import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    home: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10",
    receipt: "M9 14l6 0M9 17l6 0M9 8l6 0M5 3l14 0 0 18-3-2-2 2-2-2-2 2-2-2-3 2z",
    store: "M3 9l2-5h14l2 5M5 9v11a1 1 0 001 1h12a1 1 0 001-1V9M9 9a3 3 0 006 0M7 21h0",
    ledger: "M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2zM8 7h8M8 11h8M8 15h5",
    person: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || ""} />
    </svg>
  );
}

const navItems = [
  { to: "/", label: "হোম", icon: "home", roles: ["officer"] },
  { to: "/transactions", label: "লেনদেন", icon: "receipt", roles: ["officer"] },
  { to: "/dealers", label: "ব্যবসায়ী", icon: "store", roles: ["officer"] },
  { to: "/ledger", label: "খাতা", icon: "ledger", roles: ["officer"] },
  { to: "/officers", label: "কর্মকর্তা", icon: "person", roles: ["officer", "admin"] },
];

const roleLabel = (role: string) => (role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা");

export default function Layout() {
  const { officer, logout } = useAuth();
  const navigate = useNavigate();

  const role = officer?.role ?? "officer";
  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  function handleLogout() {
    if (!window.confirm("আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?")) return;
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-emerald-700 text-white shadow sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="SalesMaintain" className="h-8 w-8 rounded-lg object-cover" />
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
            <span className="text-base"><NavIcon name={item.icon} /></span>
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
            <NavIcon name={item.icon} />
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

