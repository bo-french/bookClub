import { useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/currently-reading", label: "Currently Reading" },
  { to: "/nominations-voting", label: "Nominations & Voting" },
  { to: "/meetings", label: "Meetings" },
];

export function Header() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-primary/10 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          {/* Logo — clickable back to dashboard */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            Book Club
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-foreground/70 hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="w-8 h-8 rounded-full border border-border"
              />
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="hidden md:inline-flex">
              Sign Out
            </Button>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <span className="block w-5 h-0.5 bg-foreground rounded" />
              <span className="block w-5 h-0.5 bg-foreground rounded" />
              <span className="block w-5 h-0.5 bg-foreground rounded" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile side panel */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <aside className="fixed top-0 right-0 z-50 h-full w-64 bg-background border-l border-border shadow-xl flex flex-col md:hidden">
            <div className="flex items-center justify-between px-5 h-14 border-b border-border">
              <span className="font-semibold text-sm">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="text-foreground/60 hover:text-foreground text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-1 px-4 py-4 flex-1">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-primary/10 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="px-4 py-4 border-t border-border flex items-center gap-3">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-8 h-8 rounded-full border border-border"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start"
                onClick={() => { signOut(); setMenuOpen(false); }}
              >
                Sign Out
              </Button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
