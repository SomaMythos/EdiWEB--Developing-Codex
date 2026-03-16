import React, { useEffect, useState } from 'react';

const ArtworkUpdateModal = ({ artwork, open, onClose, onSubmit, isSubmitting = false }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [markCompleted, setMarkCompleted] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setFile(null);
      setMarkCompleted(false);
    }
  }, [open]);

  if (!open || !artwork) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    onSubmit({
      update_title: trimmedTitle,
      photo: file,
      mark_completed: markCompleted,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card visual-update-modal" onClick={(event) => event.stopPropagation()}>
        <div className="visual-modal-head">
          <div>
            <span className="visual-kicker">Atualização</span>
            <h2>{artwork.title}</h2>
          </div>
        </div>

        <form className="modal-form visual-modal-form" onSubmit={handleSubmit}>
          <label>
            Título da atualização
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Primeira camada concluída"
              required
            />
          </label>

          <label>
            Foto
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              required
            />
          </label>

          <label className="visual-checkbox">
            <input type="checkbox" checked={markCompleted} onChange={(event) => setMarkCompleted(event.target.checked)} />
            <span>Marcar esta obra como concluída</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar atualização'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArtworkUpdateModal;
