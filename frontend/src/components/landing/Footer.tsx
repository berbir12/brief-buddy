import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border/50 py-12 px-6">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-[2px] h-4">
          {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
            <div key={i} className="w-[2px] rounded-full bg-primary" style={{ height: `${s * 100}%` }} />
          ))}
        </div>
        <span className="text-sm font-semibold text-foreground">Brief Buddy</span>
        <span className="text-xs text-muted-foreground ml-2">Your AI chief of staff.</span>
      </div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
        <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
      </div>

      <div className="text-xs text-muted-foreground/40">
        Powered by ElevenLabs & Claude AI
      </div>
    </div>
  </footer>
);

export default Footer;
