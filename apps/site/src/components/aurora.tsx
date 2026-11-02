/**
 * A soft amber aurora glowing from the bottom and the right of its parent. Four layered radial
 * gradients drift with transform only (no filter, no blur), so it stays on the compositor.
 * Place it behind the dust field, and keep reading text out of its brightest region with a scrim.
 */
export function Aurora({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`aurora ${className}`}>
      <span className="aurora-haze" />
      <span className="aurora-sweep" />
      <span className="aurora-core" />
      <span className="aurora-streak" />
    </div>
  );
}
