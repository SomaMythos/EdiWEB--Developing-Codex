import React, { useEffect, useRef, useState } from "react";
import "./RoutinesModal.css";
import AccessibleModal from "./AccessibleModal";

export default function EditBlockModal({ show, block, onClose, onSave }) {
  const [form, setForm] = useState({
    start_time: "",
    duration: 30,
    block_name: "",
    block_category: "",
    updated_source: "manual"
  });
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!block) return;
    setForm({
      start_time: block.start_time || "",
      duration: block.duration || 30,
      block_name: block.block_name || block.activity_title || "",
      block_category: block.block_category || "",
      updated_source: "manual"
    });
  }, [block]);

  if (!show || !block) return null;

  const handleSubmit = e => {
    e.preventDefault();
    onSave(block.id, {
      ...form,
      duration: Number(form.duration)
    });
    onClose();
  };

  return (
    <AccessibleModal show={show} title="Editar bloco" onClose={onClose} initialFocusRef={startTimeRef}>
      <form className="daily-modal-form" onSubmit={handleSubmit}>
        <label>
          Início
          <input
            ref={startTimeRef}
            type="time"
            value={form.start_time}
            onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))}
            required
          />
        </label>

        <label>
          Duração (min)
          <input
            type="number"
            min="1"
            value={form.duration}
            onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
            required
          />
        </label>

        <label>
          Nome
          <input
            type="text"
            value={form.block_name}
            onChange={e => setForm(prev => ({ ...prev, block_name: e.target.value }))}
          />
        </label>

        <label>
          Categoria
          <input
            type="text"
            value={form.block_category}
            onChange={e => setForm(prev => ({ ...prev, block_category: e.target.value }))}
            placeholder="Opcional"
          />
        </label>

        <div className="daily-modal-actions">
          <button type="button" className="daily-button daily-button--secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="daily-button daily-button--primary">Salvar</button>
        </div>
      </form>
    </AccessibleModal>
  );
}
