import React, { useMemo, useState } from 'react';
import { CalendarRange, Check, CheckCheck, PencilLine, Trash2 } from 'lucide-react';
import { resolveMediaUrl } from '../utils/mediaUrl';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const ArtworkCard = ({
  artwork,
  uiMode = 'view',
  onOpenGallery,
  onOpenUpdate,
  onSaveCompletionDate,
  onDelete,
  isSavingCompletion,
}) => {
  const [completionDate, setCompletionDate] = useState(artwork.finished_at ? artwork.finished_at.slice(0, 10) : '');

  const previewUrl = useMemo(() => {
    const latestProgress =
      artwork.latest_photo_url ||
      artwork.progress_photo_urls?.[artwork.progress_photo_urls.length - 1] ||
      artwork.progress_photo_paths?.[artwork.progress_photo_paths.length - 1];

    return resolveMediaUrl(latestProgress, latestProgress, artwork.reference_image_url, artwork.reference_image_path);
  }, [artwork]);

  const startLabel = formatDate(artwork.started_at || artwork.created_at);
  const finishLabel = formatDate(artwork.finished_at);
  const isCompleted = ['concluido', 'concluído'].includes((artwork.status || '').toLowerCase());

  return (
    <article
      className={`artwork-card ${uiMode === 'edit' ? 'is-edit' : 'is-view'}`}
      onClick={() => onOpenGallery(artwork)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenGallery(artwork);
        }
      }}
    >
      <div className="artwork-card-cover-shell">
        {previewUrl ? (
          <img src={previewUrl} alt={artwork.title} className="artwork-card-cover" />
        ) : (
          <div className="artwork-card-fallback">
            <span>{artwork.title}</span>
          </div>
        )}

        <div className="artwork-card-overlay">
          <div className="artwork-card-overlay-copy">
            <strong>{artwork.title}</strong>
            <small>
              {finishLabel ? `Fim ${finishLabel}` : startLabel ? `Início ${startLabel}` : ''}
            </small>
          </div>
        </div>
      </div>

      {uiMode === 'edit' ? (
        <div className="artwork-card-meta" onClick={(event) => event.stopPropagation()}>
          <div className="artwork-card-meta-copy">
            <strong>{artwork.title}</strong>
            <span>{artwork.size || 'Sem tamanho definido'}</span>
            <div className="artwork-card-date-row">
              {startLabel ? (
                <span>
                  <CalendarRange size={13} /> {startLabel}
                </span>
              ) : null}
              {finishLabel ? (
                <span>
                  <CheckCheck size={13} /> {finishLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="artwork-card-controls">
            <div className="artwork-card-actions artwork-icon-actions">
              <button type="button" className="artwork-icon-btn" title="Atualizar" onClick={() => onOpenUpdate(artwork)}>
                <PencilLine size={16} />
              </button>
              <button type="button" className="artwork-icon-btn is-danger" title="Excluir" onClick={() => onDelete(artwork)}>
                <Trash2 size={16} />
              </button>
            </div>

            <div className="artwork-card-completion elevation-0">
              <input
                type="date"
                className="input"
                value={completionDate}
                onChange={(event) => setCompletionDate(event.target.value)}
                aria-label="Data de conclusão"
              />
              <button
                type="button"
                className="artwork-icon-btn is-primary"
                disabled={isSavingCompletion}
                title="Salvar conclusão"
                onClick={() => onSaveCompletionDate(artwork, completionDate)}
              >
                {isSavingCompletion ? '...' : <Check size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
};

export default ArtworkCard;
