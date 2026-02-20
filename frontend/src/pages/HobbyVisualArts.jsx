import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import AnimatedCard from '../components/AnimatedCard';
import StaggerList from '../components/StaggerList';
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
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [isSavingCompletionId, setIsSavingCompletionId] = useState(null);
  const [pendingDeleteArtwork, setPendingDeleteArtwork] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const cancelDeleteRef = useRef(null);

  const currentTab = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab]);
  const usesCardFlow = !!currentTab && sharedArtworkFlow.has(currentTab.key);
  const reduceMotion = useReducedMotion();

  const modalMotionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
        transition: { duration: 0.2 },
      };

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
    } catch (err) {
      console.error('Erro ao carregar obras', err);
      setFeedback({ type: 'error', message: 'Não foi possível carregar as obras.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pendingDeleteArtwork && cancelDeleteRef.current) {
      cancelDeleteRef.current.focus();
    }
  }, [pendingDeleteArtwork]);

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

    setIsSubmittingCreate(true);
    setFeedback({ type: '', message: '' });
    try {
      await paintingsApi.create({
        title: form.title,
        size: form.size,
        started_at: form.started_at,
        category: currentTab.key,
        reference_image: form.referenceFile,
      });

      setForm(initialForm);
      setCreateModalOpen(false);
      setFeedback({ type: 'success', message: 'Obra criada com sucesso.' });
      await load(currentTab.key);
    } catch (err) {
      console.error('Erro ao criar obra', err);
      setFeedback({ type: 'error', message: 'Não foi possível criar a obra.' });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSubmitUpdate = async ({ update_title, photo, mark_completed }) => {
    if (!selectedArtwork || !currentTab) return;

    setIsSubmittingUpdate(true);
    setFeedback({ type: '', message: '' });
    try {
      await paintingsApi.createUpdate(selectedArtwork.id, {
        update_title,
        photo,
        mark_completed,
      });

      setUpdateModalOpen(false);
      setSelectedArtwork(null);
      setFeedback({ type: 'success', message: 'Atualização salva com sucesso.' });
      await load(currentTab.key);
    } catch (err) {
      console.error('Erro ao enviar atualização', err);
      setFeedback({ type: 'error', message: 'Não foi possível salvar a atualização.' });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };
  
  const saveCompletionDate = async (artwork, date) => {
    if (!currentTab || isSavingCompletionId) return;

    setIsSavingCompletionId(artwork.id);
    setFeedback({ type: '', message: '' });
    try {
      await paintingsApi.updateCompletionDate(artwork.id, {
        finished_at: date || null,
      });

      setFeedback({ type: 'success', message: 'Data de conclusão salva.' });
      await load(currentTab.key);
    } catch (err) {
      console.error('Erro ao salvar data de conclusão', err);
      setFeedback({ type: 'error', message: 'Não foi possível salvar a data de conclusão.' });
    } finally {
      setIsSavingCompletionId(null);
    }
  };

  const handleDeleteArtwork = async () => {
    if (!currentTab || !pendingDeleteArtwork) return;

    setIsDeleting(true);
    setFeedback({ type: '', message: '' });
    try {
      await paintingsApi.deleteArtwork(pendingDeleteArtwork.id);
      setPendingDeleteArtwork(null);
      setFeedback({ type: 'success', message: 'Obra excluída com sucesso.' });
      await load(currentTab.key);
    } catch (err) {
      console.error('Erro ao excluir obra', err);
      setFeedback({ type: 'error', message: 'Não foi possível excluir a obra.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const openGallery = async (selected) => {
    if (!selected) return;
    setFeedback({ type: '', message: '' });
    try {
      const res = await paintingsApi.listUpdates(selected.id);
      setGalleryArtwork({
        ...selected,
        updates: res?.data?.data || [],
      });
    } catch (err) {
      console.error('Erro ao abrir galeria', err);
      setFeedback({ type: 'error', message: 'Não foi possível carregar a galeria da obra.' });
    }
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

      {feedback.message ? <div className={`upload-feedback ${feedback.type}`}>{feedback.message}</div> : null}

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
    <motion.div className="modal-card" {...modalMotionProps}>
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

          <button className="btn btn-primary" type="submit" disabled={isSubmittingCreate}>
            {isSubmittingCreate ? 'Criando...' : 'Criar obra'}
          </button>
        </div>
      </form>
    </motion.div>
  </div>
)}

          {isLoading && <p className="visual-arts-loading">Carregando obras...</p>}

          <StaggerList
            items={artworks}
            className="visual-arts-grid"
            getKey={(artwork) => artwork.id}
            renderItem={(artwork) => (
              <AnimatedCard>
                <ArtworkCard
                  artwork={artwork}
                  onOpenUpdate={(selected) => {
                    setSelectedArtwork(selected);
                    setUpdateModalOpen(true);
                  }}
                  onOpenGallery={openGallery}
                  onSaveCompletionDate={saveCompletionDate}
                  onDelete={setPendingDeleteArtwork}
                  isSavingCompletion={isSavingCompletionId === artwork.id}
                />
              </AnimatedCard>
            )}
          />

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
            isSubmitting={isSubmittingUpdate}
          />

          <ArtworkGalleryModal
            artwork={galleryArtwork}
            open={!!galleryArtwork}
            onClose={() => setGalleryArtwork(null)}
          />

          {pendingDeleteArtwork && (
            <div className="modal-backdrop" onClick={() => !isDeleting && setPendingDeleteArtwork(null)}>
              <motion.div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-artwork-title" onClick={(e) => e.stopPropagation()} {...modalMotionProps}>
                <h2 id="delete-artwork-title">Excluir obra</h2>
                <p>Tem certeza que deseja excluir a obra "{pendingDeleteArtwork.title}"?</p>
                <div className="modal-actions">
                  <button ref={cancelDeleteRef} type="button" className="btn" onClick={() => setPendingDeleteArtwork(null)} disabled={isDeleting}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteArtwork} disabled={isDeleting}>
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
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
