import { Link } from "react-router-dom";

export function Breadcrumb({ items = [] }) {
  if (items.length === 0) return null;
  return (
    <nav className="text-sm text-text-secondary mb-4" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-border">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-text-primary transition-colors">{item.label}</Link>
          ) : (
            <span className="text-text-primary font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
