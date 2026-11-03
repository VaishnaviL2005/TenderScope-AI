import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import BackendIndicator from "./BackendIndicator";

const NAV = [
  { to: "/", label: "Overview", end: true, icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { to: "/upload", label: "Upload Tender", end: false, icon: "M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" },
  { to: "/history", label: "Tender History", end: false, icon: "M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { to: "/reports", label: "Analysis Reports", end: false, icon: "M9 17v-6m3 6V7m3 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-navy-900 text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 print:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-sm font-bold">TS</div>
              <div className="text-lg font-semibold">TenderScope AI</div>
            </div>
            <p className="mt-3 text-xs leading-snug text-navy-200">Intelligent Tender Analysis. Smarter Product Decisions.</p>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"}`
                }
              >
                <Icon d={n.icon} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4">
            <BackendIndicator />
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-navy-900 px-4 py-3 text-white md:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded p-1 hover:bg-white/10">
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <span className="font-semibold">TenderScope AI</span>
          <span className="w-7" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
