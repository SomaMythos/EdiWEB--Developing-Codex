import React, { useEffect, useId, useRef } from "react";
import "./AccessibleModal.css";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export default function AccessibleModal({
  show,
  title,
  onClose,
  children,
  size = "default",
  initialFocusRef,
  labelledById,
  className = ""
}) {
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const generatedId = useId();
  const titleId = labelledById || `modal-title-${generatedId}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!show) return undefined;
    const previousActive = document.activeElement;

    const node = modalRef.current;
    const focusables = node ? Array.from(node.querySelectorAll(FOCUSABLE)) : [];
    const firstFocusable = initialFocusRef?.current || focusables[0] || node;
    firstFocusable?.focus?.();

    const handleKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const currentFocusables = node ? Array.from(node.querySelectorAll(FOCUSABLE)) : [];
      if (!currentFocusables.length) {
        event.preventDefault();
        node?.focus();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus?.();
    };
  }, [show, initialFocusRef]);

  if (!show) return null;

  return (
    <div className="daily-modal-overlay" onMouseDown={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`daily-modal glass-scrollbar ${size === "wide" ? "daily-modal--wide" : ""} ${className}`.trim()}
        onMouseDown={event => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
