import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import StaggerList from './StaggerList';
import { resolveMediaUrl } from '../utils/mediaUrl';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const ArtworkGalleryModal = ({ artwork, open, onClose }) => {
  const [zoomedImage, setZoomedImage] = useState(null);
  const reduceMotion = useReducedMotion();

  const modalMotionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
        transition: { duration: 0.2 },
      };

  const galleryItems = useMemo(() => {
    if (!artwork) return [];

    const updates = [...(artwork.updates || [])]
      .sort((a, b) => new Date(a.timestamp || a.created_at || a.date || 0) - new Date(b.timestamp || b.created_at || b.date || 0))
      .map((update) => ({
        id: `update-${update.id}`,
        title: update.update_title || update.title || 'Atualização sem título',
        date: update.timestamp || update.created_at || update.date,
        imageUrl: resolveMediaUrl(update.photo_url, update.photo_path, update.image_url, update.image_path),
      }));

    const referenceImageUrl = resolveMediaUrl(artwork.reference_image_url, artwork.reference_image_path);
    const reference = referenceImageUrl
      ? [{ id: `reference-${artwork.id}`, title: 'Referência', date: artwork.started_at || artwork.created_at, imageUrl: referenceImageUrl }]
      : [];

    return [...reference, ...updates].filter((item) => item.imageUrl);
  }, [artwork]);

  if (!open || !artwork) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal-card modal-gallery" onClick={(e) => e.stopPropagation()} {...modalMotionProps}>
        <h2>Galeria cronológica • {artwork.title}</h2>

        {galleryItems.length ? (
          <StaggerList
            items={galleryItems}
            className="gallery-list"
            getKey={(item) => item.id}
            renderItem={(item) => (
              <div className="gallery-item">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="gallery-thumb"
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoomedImage(item.imageUrl)}
                    onKeyDown={(e) => e.key === 'Enter' && setZoomedImage(item.imageUrl)}
                  />
                )}
                <div>
                  <h4>{item.title}</h4>
                  <p>{formatDateTime(item.date)}</p>
                </div>
              </div>
            )}
          />
        ) : (
          <p>Nenhuma atualização registrada.</p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </motion.div>

      {zoomedImage && (
        <div className="modal-backdrop modal-image-viewer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Visualização ampliada" className="modal-image-viewer-content" />
        </div>
      )}
    </div>
  );
};

export default ArtworkGalleryModal;
