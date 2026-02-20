import React, { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from '../utils/mediaUrl';

const STATUS_LABELS = {
  em_andamento: 'Em andamento',
  em_progresso: 'Em Progresso',
  concluido: 'Concluído',
  concluído: 'Concluído',
  paused: 'Pausado',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const ArtworkCard = ({
  artwork,
  onOpenGallery,
  onOpenUpdate,
  onSaveCompletionDate,
  onDelete,
}) => {
const [completionDate, setCompletionDate] = useState(
  artwork.finished_at ? artwork.finished_at.slice(0, 10) : ''
);

// Slideshow state
const [hovering, setHovering] = useState(false);
const [slideIndex, setSlideIndex] = useState(0);

useEffect(() => {
  setCompletionDate(
    artwork.finished_at ? artwork.finished_at.slice(0, 10) : ''
  );
}, [artwork.finished_at]);

// Todas as imagens possíveis para slideshow
const imageList = useMemo(() => {
  if (artwork.progress_photo_urls?.length) {
    return artwork.progress_photo_urls;
  }

  if (artwork.progress_photo_paths?.length) {
    return artwork.progress_photo_paths.map((path) =>
      resolveMediaUrl(path)
    );
  }

  if (artwork.reference_image_url || artwork.reference_image_path) {
    return [
      resolveMediaUrl(
        artwork.reference_image_url,
        artwork.reference_image_path
      ),
    ];
  }

  return [];
}, [artwork]);

useEffect(() => {
  if (!hovering) return;
  if (!imageList || imageList.length <= 1) return;

  const interval = setInterval(() => {
    setSlideIndex((prev) =>
      prev + 1 >= imageList.length ? 0 : prev + 1
    );
  }, 1200);

  return () => clearInterval(interval);
}, [hovering, imageList]);

// Thumb principal (agora usa slideIndex)
const thumbnailUrl = imageList.length
  ? imageList[slideIndex] || imageList[0]
  : '';
  

const handleDelete = () => {
  console.log("CLIQUEI EM EXCLUIR");

  const confirmed = window.confirm(
    `Tem certeza que deseja excluir a obra "${artwork.title}"?`
  );

  console.log("CONFIRMADO?", confirmed);
  console.log("onDelete existe?", !!onDelete);

  if (confirmed && onDelete) {
    console.log("VOU CHAMAR onDelete");
    onDelete(artwork);
  }
};

  return (
    <article
      className="artwork-card"
      onClick={() => onOpenGallery(artwork)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenGallery(artwork)}
    >
     <div
        className="artwork-thumb-wrap"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          setSlideIndex(0);
        }}
      >
{imageList.length ? (
  <div className="artwork-thumb-slider">
    {imageList.map((img, index) => (
      <img
        key={index}
        src={img}
        alt={artwork.title}
        className={`artwork-thumb ${
          index === slideIndex ? 'active' : ''
        }`}
      />
    ))}
  </div>
) : (
  <div className="artwork-thumb artwork-thumb-empty">
    Sem imagem
  </div>
)}
      </div>

      <div className="artwork-card-content">
        <h3>{artwork.title}</h3>
        <p>Início: {formatDate(artwork.started_at || artwork.start_date)}</p>
<p>
  Status:{' '}
  {STATUS_LABELS[artwork.status] ||
    artwork.status ||
    'Em andamento'}
</p>

{artwork.finished_at && (
  <p style={{ fontSize: 13, opacity: 0.8 }}>
    Concluído em: {formatDate(artwork.finished_at)}
  </p>
)}

<div
  className="artwork-card-actions"
  onClick={(e) => e.stopPropagation()}
>
  {artwork.status !== 'concluído' && (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onOpenUpdate(artwork)}
      >
        Atualizar
      </button>

      <div className="artwork-completion-edit">
        <input
          type="date"
          className="input"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          aria-label="Data de conclusão"
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() =>
            onSaveCompletionDate(artwork, completionDate)
          }
        >
          Salvar conclusão
        </button>
      </div>
    </>
  )}

  <button
    type="button"
    className="btn btn-danger btn-sm"
    onClick={handleDelete}
  >
    Excluir
  </button>
</div>
      </div>
    </article>
  );
};

export default ArtworkCard;
