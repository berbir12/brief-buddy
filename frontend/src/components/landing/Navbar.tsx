import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Demo", href: "#demo" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      await loginDemo();
      navigate("/dashboard");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-end gap-[2px] h-5">
            {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
              <div key={i} className="w-[3px] rounded-full bg-primary" style={{ height: `${s * 100}%` }} />
            ))}
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Brief Buddy</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <button
                onClick={handleTryDemo}
                disabled={demoLoading}
                className="bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
              >
                {demoLoading ? "Signing in…" : "Try demo"}
              </button>
            </>
          )}
          <a href="#pricing" className="bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold hover:brightness-110 transition-all">
            Get early access
          </a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-background border-b border-border"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map(l => (
                <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground">
                  {l.label}
                </a>
              ))}
              {isAuthenticated ? (
                <Link to="/dashboard" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">
                    Sign in
                  </Link>
                  <button
                    onClick={() => { void handleTryDemo(); setOpen(false); }}
                    disabled={demoLoading}
                    className="bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold text-center disabled:opacity-50"
                  >
                    {demoLoading ? "Signing in…" : "Try demo"}
                  </button>
                </>
              )}
              <a href="#pricing" className="bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold text-center">
                Get early access
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
