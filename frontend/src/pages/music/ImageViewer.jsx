import { useState, useRef } from "react";

export default function ImageViewer({ src, onClose }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = (e) => {
    e.preventDefault();
    const newScale = Math.min(Math.max(scale + e.deltaY * -0.001, 1), 5);
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!dragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;

    setPosition((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div
        className="image-viewer-container"
        onClick={(e) => e.stopPropagation()}
      >
        <img
  src={src}
  alt="Zoom"
  onWheel={handleWheel}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  draggable={false}
  style={{
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
    transformOrigin: "center center",
  }}
/>
      </div>
    </div>
  );
}