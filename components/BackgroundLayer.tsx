export function BackgroundLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      {/* Base */}
      <div className="absolute inset-0 bg-[#f5f5f7]" />

      {/* Soft ambient color to give glassmorphism something to blur */}
      <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-100/40 blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-100/30 blur-[100px]" />
      <div className="absolute top-[30%] left-[40%] w-[40vw] h-[30vw] rounded-full bg-emerald-100/20 blur-[80px]" />
    </div>
  );
}
