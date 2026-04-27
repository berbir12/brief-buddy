import { motion } from "framer-motion";

const HeroSection = () => (
  <section className="pt-[18vh] pb-[10vh] px-6 flex flex-col items-center text-center relative overflow-hidden">
    {/* Subtle gradient orb */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="label-caps text-primary mb-6"
    >
      Now integrated with ElevenLabs
    </motion.span>

    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter text-balance mb-6 max-w-4xl"
    >
      Your morning briefing.
      <br />
      <span className="text-foreground/40">In your voice.</span>
    </motion.h1>

    <motion.p
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed"
    >
      Brief Buddy calls you every morning with a personalized AI briefing — your emails, calendar, deals, and news. Hands-free. 90 seconds. Done.
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex flex-col sm:flex-row gap-4"
    >
      <a href="#pricing" className="bg-accent text-accent-foreground px-8 py-4 rounded-full font-semibold hover:brightness-110 transition-all">
        Start free trial
      </a>
      <a href="#demo" className="bg-foreground/5 border border-foreground/10 backdrop-blur-md px-8 py-4 rounded-full font-semibold hover:bg-foreground/10 transition-all text-foreground">
        Hear a sample call
      </a>
    </motion.div>

  </section>
);

export default HeroSection;
