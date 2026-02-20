import React, { useEffect, useState } from 'react';
import ArtworkCard from '../components/ArtworkCard';
import ArtworkUpdateModal from '../components/ArtworkUpdateModal';
import ArtworkGalleryModal from '../components/ArtworkGalleryModal';
import { paintingsApi } from '../services/api';
import './Paintings.css';

const initialForm = {
  title: '',
  size: '',
  started_at: '',
  referenceFile: null,
};

const Paintings = () => {
  const [artworks, setArtworks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const load = async () => {
    const res = await paintingsApi.list();
    setArtworks(res.data.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await paintingsApi.createArtwork({
      title: form.title,
      size: form.size,
      started_at: form.started_at,
      reference_image: form.referenceFile,
    });
    setForm(initialForm);
    await load();
  };

  const handleSubmitUpdate = async ({ update_title, photo, mark_completed }) => {
    if (!selectedArtwork) return;
    await paintingsApi.createUpdate(selectedArtwork.id, {
      update_title,
      photo,
      mark_completed,
    });

    setUpdateModalOpen(false);
    setSelectedArtwork(null);
    await load();
  };

  const saveCompletionDate = async (artwork, date) => {
    await paintingsApi.updateCompletionDate(artwork.id, {
      finished_at: date || null,
    });
    await load();
  };

  const handleDeleteArtwork = async (artwork) => {
    await paintingsApi.deleteArtwork(artwork.id);
    await load();
  };

  return (
    <div className="page-container fade-in paintings-page">
      <h1>Pinturas</h1>

      <form onSubmit={handleCreate} className="card paintings-create-form">
        <h2>Nova obra</h2>

        <input
          className="input"
          placeholder="Título"
          value={form.title}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
          required
        />

        <input
          className="input"
          placeholder="Tamanho (ex: 50x70cm)"
          value={form.size}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, size: e.target.value }))
          }
        />

        <input
          className="input"
          type="date"
          value={form.started_at}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, started_at: e.target.value }))
          }
          required
        />

        <input
          className="input"
          type="file"
          accept="image/*"
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              referenceFile: e.target.files?.[0] || null,
            }))
          }
          required
        />

        <button className="btn btn-primary" type="submit">
          Criar obra
        </button>
      </form>

      <section className="paintings-grid">
        {artworks.map((artwork) => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            onOpenUpdate={(selected) => {
              setSelectedArtwork(selected);
              setUpdateModalOpen(true);
            }}
            onOpenGallery={(selected) => {
              setSelectedArtwork(selected);
              setGalleryOpen(true);
            }}
            onSaveCompletionDate={saveCompletionDate}
            onDelete={handleDeleteArtwork}
          />
        ))}
      </section>

      {!artworks.length && (
        <p className="paintings-empty">
          Nenhuma obra cadastrada ainda.
        </p>
      )}

      <ArtworkUpdateModal
        artwork={selectedArtwork}
        open={updateModalOpen}
        onClose={() => {
          setUpdateModalOpen(false);
          setSelectedArtwork(null);
        }}
        onSubmit={handleSubmitUpdate}
      />

      <ArtworkGalleryModal
        artwork={selectedArtwork}
        open={galleryOpen}
        onClose={() => {
          setGalleryOpen(false);
          setSelectedArtwork(null);
        }}
      />
    </div>
  );
};

export default Paintings;
