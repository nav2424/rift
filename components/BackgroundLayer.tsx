export function BackgroundLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      {/* base */}
      <div className="absolute inset-0 bg-black" />

      {/* soft orbs */}
      <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-white/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-white/8 blur-[140px]" />
      <div className="absolute bottom-[-220px] left-1/3 h-[620px] w-[620px] rounded-full bg-white/6 blur-[160px]" />

      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at center, black 45%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 45%, transparent 75%)",
        }}
      />

      {/* noise */}
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.25%22/%3E%3C/svg%3E')",
        }}
      />
    </div>
  );
}

