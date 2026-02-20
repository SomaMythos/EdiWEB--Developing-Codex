import React, { useEffect, useMemo, useState } from 'react';
import ArtworkCard from '../components/ArtworkCard';
import ArtworkUpdateModal from '../components/ArtworkUpdateModal';
import ArtworkGalleryModal from '../components/ArtworkGalleryModal';
import MediaFolderSection from '../components/MediaFolderSection';
import { paintingsApi } from '../services/api';
import './HobbyVisualArts.css';

const tabs = [
  { key: 'pintura', label: 'Pintura' },
  { key: 'pintura_digital', label: 'Pintura Digital' },
  { key: 'desenho_tradicional', label: 'Desenho Tradicional' },
  { key: 'fotografia', label: 'Fotografia' },
  { key: 'ai', label: 'AI' },
  { key: 'design_grafico', label: 'Design Gráfico' },
  { key: 'outros', label: 'Outros' },
];

const sharedArtworkFlow = new Set(['pintura', 'pintura_digital', 'desenho_tradicional']);

const initialForm = {
  title: '',
  size: '',
  started_at: '',
  referenceFile: null,
};

const HobbyVisualArts = () => {
  const [activeTab, setActiveTab] = useState('pintura');
  const [artworks, setArtworks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [galleryArtwork, setGalleryArtwork] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const currentTab = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab]);
  const usesCardFlow = !!currentTab && sharedArtworkFlow.has(currentTab.key);

  const load = async (category) => {
    setIsLoading(true);
    try {
      const res = await paintingsApi.list(undefined, category);
      const items = (res.data.data || []).map((artwork) => ({
        ...artwork,
        progress_photo_urls: artwork.progress_photo_urls || [],
        progress_photo_paths: artwork.progress_photo_paths || [],
      }));
      setArtworks(items);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!usesCardFlow || !currentTab) {
      setArtworks([]);
      return;
    }

    load(currentTab.key);
  }, [usesCardFlow, currentTab]);

  const handleCreateArtwork = async (e) => {
    e.preventDefault();
    if (!currentTab) return;
    if (sharedArtworkFlow.has(currentTab.key) && !form.referenceFile) return;

    await paintingsApi.create({
      title: form.title,
      size: form.size,
      started_at: form.started_at,
      category: currentTab.key,
      reference_image: form.referenceFile,
    });

    setForm(initialForm);
	setCreateModalOpen(false);
    await load(currentTab.key);
	
  };

  const handleSubmitUpdate = async ({ update_title, photo, mark_completed }) => {
    if (!selectedArtwork || !currentTab) return;

    await paintingsApi.createUpdate(selectedArtwork.id, {
      update_title,
      photo,
      mark_completed,
    });

    setUpdateModalOpen(false);
    setSelectedArtwork(null);
    await load(currentTab.key);
  };
  
  const saveCompletionDate = async (artwork, date) => {
  if (!currentTab) return;

  await paintingsApi.updateCompletionDate(artwork.id, {
    finished_at: date || null,
  });

  await load(currentTab.key);
};

const handleDeleteArtwork = async (artwork) => {
  if (!currentTab) return;

  await paintingsApi.deleteArtwork(artwork.id);
  await load(currentTab.key);
};

  const openGallery = async (selected) => {
    if (!selected) return;
    const res = await paintingsApi.listUpdates(selected.id);
    setGalleryArtwork({
      ...selected,
      updates: res?.data?.data || [],
    });
  };

  return (
    <div className="page-container fade-in">
      <h1>Artes Visuais</h1>

      <div className="visual-arts-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`visual-arts-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {usesCardFlow ? (
        <>
<div style={{ marginTop: '16px' }}>
  <button
    className="btn btn-primary"
    type="button"
    onClick={() => setCreateModalOpen(true)}
  >
    Nova obra
  </button>
</div>

{createModalOpen && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h2>Nova obra • {currentTab.label}</h2>

      <form onSubmit={handleCreateArtwork} className="modal-form">
        <input
          className="input"
          placeholder="Título"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          required
        />

        <input
          className="input"
          placeholder="Tamanho (ex: 50x70cm)"
          value={form.size}
          onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
        />

        <input
          className="input"
          type="date"
          value={form.started_at}
          onChange={(e) => setForm((prev) => ({ ...prev, started_at: e.target.value }))}
          required
        />

        <input
          className="input"
          type="file"
          accept="image/*"
          required={sharedArtworkFlow.has(currentTab.key)}
          onChange={(e) => setForm((prev) => ({ ...prev, referenceFile: e.target.files?.[0] || null }))}
        />

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setCreateModalOpen(false)}
          >
            Cancelar
          </button>

          <button className="btn btn-primary" type="submit">
            Criar obra
          </button>
        </div>
      </form>
    </div>
  </div>
)}

          {isLoading && <p className="visual-arts-loading">Carregando obras...</p>}

          <section className="visual-arts-grid">
            {artworks.map((artwork) => (
<ArtworkCard
  key={artwork.id}
  artwork={artwork}
  onOpenUpdate={(selected) => {
    setSelectedArtwork(selected);
    setUpdateModalOpen(true);
  }}
  onOpenGallery={openGallery}
  onSaveCompletionDate={saveCompletionDate}
  onDelete={handleDeleteArtwork}
/>
            ))}
          </section>

          {!isLoading && !artworks.length && (
            <p className="visual-arts-empty">Nenhuma obra cadastrada ainda para {currentTab.label.toLowerCase()}.</p>
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
            artwork={galleryArtwork}
            open={!!galleryArtwork}
            onClose={() => setGalleryArtwork(null)}
          />
        </>
      ) : (
        <MediaFolderSection
          category={currentTab?.key || 'outros'}
          title={`${currentTab?.label || 'Outros'}`}
        />
      )}
    </div>
  );
};

export default HobbyVisualArts;
