export function BackgroundLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[#fbfbfd]" />
    </div>
  );
}
