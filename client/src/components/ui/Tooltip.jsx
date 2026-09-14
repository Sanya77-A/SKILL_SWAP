import { cloneElement, isValidElement, useId, useState } from "react";

export function Tooltip({ children, content, ...props }) {
  const [show, setShow] = useState(false);
  const tooltipId = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      {...props}
    >
      {isValidElement(children) ? cloneElement(children, { "aria-describedby": content ? tooltipId : undefined }) : children}
      {show && content && (
        <span
          className="pointer-events-none absolute -top-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-glass"
          role="tooltip"
          id={tooltipId}
        >
          {content}
        </span>
      )}
    </span>
  );
}
