import React, { useState } from 'react';

const ArtworkUpdateModal = ({ artwork, open, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [markCompleted, setMarkCompleted] = useState(false);

  if (!open || !artwork) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSubmit({
      update_title: trimmedTitle,
      photo: file,
      mark_completed: markCompleted,
    });
    setTitle('');
    setFile(null);
    setMarkCompleted(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Atualizar: {artwork.title}</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="label" htmlFor="update-title">Título da atualização</label>
          <input
            id="update-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Primeira camada concluída"
            required
          />

          <label className="label" htmlFor="update-file">Upload da foto</label>
          <input
            id="update-file"
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />

          <label className="modal-checkbox">
            <input type="checkbox" checked={markCompleted} onChange={(e) => setMarkCompleted(e.target.checked)} />
            Concluir
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar atualização</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArtworkUpdateModal;
