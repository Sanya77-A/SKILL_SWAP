export function Avatar({ src, name, size = "md", className = "" }) {
  const sizeClass = size === "sm"
    ? "w-8 h-8 text-sm"
    : size === "xl"
      ? "w-28 h-28 text-3xl"
      : size === "lg"
        ? "w-16 h-16 text-xl"
        : "w-10 h-10 text-base";
  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 bg-surface-2 border border-border flex items-center justify-center font-heading font-semibold text-text-secondary ${className}`}
      title={name}
    >
      {src ? (
        <img src={src} alt={name || "Avatar"} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
