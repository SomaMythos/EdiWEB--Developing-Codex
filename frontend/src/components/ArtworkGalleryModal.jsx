import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { resolveMediaUrl } from '../utils/mediaUrl';

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const ArtworkGalleryModal = ({ artwork, open, onClose }) => {
  const [zoomedImage, setZoomedImage] = useState(null);

  const galleryItems = useMemo(() => {
    if (!artwork) return [];

    const updates = [...(artwork.updates || [])]
      .sort((left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0))
      .map((update) => ({
        id: `update-${update.id}`,
        type: 'Progresso',
        title: update.update_title || 'Atualização',
        date: update.timestamp,
        imageUrl: resolveMediaUrl(update.photo_url, update.photo_path),
      }));

    const referenceImageUrl = resolveMediaUrl(artwork.reference_image_url, artwork.reference_image_path);
    const reference = referenceImageUrl
      ? [{
          id: `reference-${artwork.id}`,
          type: 'Referência',
          title: 'Imagem base',
          date: artwork.started_at || artwork.created_at,
          imageUrl: referenceImageUrl,
        }]
      : [];

    return [...reference, ...updates].filter((item) => item.imageUrl);
  }, [artwork]);

  if (!open || !artwork) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card visual-gallery-modal" onClick={(event) => event.stopPropagation()}>
        <div className="visual-modal-head">
          <div>
            <span className="visual-kicker">Galeria</span>
            <h2>{artwork.title}</h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={16} /> Fechar
          </button>
        </div>

        {galleryItems.length ? (
          <div className="gallery-list glass-scrollbar">
            {galleryItems.map((item) => (
              <div key={item.id} className="gallery-item elevation-1">
                <button type="button" className="gallery-thumb-button" onClick={() => setZoomedImage(item.imageUrl)}>
                  <img src={item.imageUrl} alt={item.title} className="gallery-thumb" />
                </button>
                <div className="gallery-copy">
                  <span className="gallery-pill">{item.type}</span>
                  <h4>{item.title}</h4>
                  <p>{formatDateTime(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="visual-empty-state page-shell">
            <span className="visual-kicker">Vazio</span>
            <h3>Nenhum registro visual ainda.</h3>
          </div>
        )}
      </div>

      {zoomedImage ? (
        <div className="modal-backdrop modal-image-viewer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Visualização ampliada" className="modal-image-viewer-content" />
        </div>
      ) : null}
    </div>
  );
};

export default ArtworkGalleryModal;
