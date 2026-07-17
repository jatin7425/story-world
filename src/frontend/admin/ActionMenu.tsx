import { useEffect, useRef, useState } from "react";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** A "⋮" button that pops up a small list of actions. Closes on outside click or Escape. */
export default function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="action-menu" ref={ref}>
      <button
        type="button"
        className="action-menu-trigger"
        aria-label="Actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <div className="action-menu-dropdown">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`action-menu-item ${item.danger ? "action-menu-item-danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
