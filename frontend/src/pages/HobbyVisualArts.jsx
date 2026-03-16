import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarRange, ImagePlus, PencilLine, Plus, Trash2 } from 'lucide-react';
import ArtworkCard from '../components/ArtworkCard';
import ArtworkUpdateModal from '../components/ArtworkUpdateModal';
import ArtworkGalleryModal from '../components/ArtworkGalleryModal';
import MediaFolderSection from '../components/MediaFolderSection';
import { paintingsApi } from '../services/api';
import './HobbyVisualArts.css';

const tabs = [
  { key: 'pintura', label: 'Pintura' },
  { key: 'pintura_digital', label: 'Pintura digital' },
  { key: 'desenho_tradicional', label: 'Desenho tradicional' },
  { key: 'fotografia', label: 'Fotografia' },
  { key: 'ai', label: 'AI' },
  { key: 'design_grafico', label: 'Design gráfico' },
  { key: 'outros', label: 'Outros' },
];

const sharedArtworkFlow = new Set(['pintura', 'pintura_digital', 'desenho_tradicional']);

const initialForm = {
  title: '',
  size: '',
  referenceFile: null,
};

const isCompletedArtwork = (artwork) => ['concluido', 'concluído'].includes((artwork.status || '').toLowerCase());

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const logLabelByType = {
  artwork_created: 'Obra criada',
  artwork_update: 'Atualização',
  artwork_completed: 'Conclusão',
  media_folder: 'Pasta criada',
  media_item: 'Imagem adicionada',
};

const HobbyVisualArts = () => {
  const [uiMode, setUiMode] = useState('view');
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [logData, setLogData] = useState([]);
  const [pendingDeleteArtwork, setPendingDeleteArtwork] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const cancelDeleteRef = useRef(null);

  const currentTab = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab]);
  const usesCardFlow = !!currentTab && sharedArtworkFlow.has(currentTab.key);

  const load = async (category) => {
    setIsLoading(true);
    try {
      const response = await paintingsApi.list(undefined, category);
      const items = (response.data.data || []).map((artwork) => ({
        ...artwork,
        progress_photo_urls: artwork.progress_photo_urls || [],
        progress_photo_paths: artwork.progress_photo_paths || [],
      }));
      setArtworks(items);
    } catch (error) {
      console.error('Erro ao carregar obras', error);
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

  const handleCreateArtwork = async (event) => {
    event.preventDefault();
    if (!currentTab) return;
    if (sharedArtworkFlow.has(currentTab.key) && !form.referenceFile) return;

    setIsSubmittingCreate(true);
    setFeedback({ type: '', message: '' });

    try {
      await paintingsApi.create({
        title: form.title.trim(),
        size: form.size.trim(),
        category: currentTab.key,
        reference_image: form.referenceFile,
      });

      setForm(initialForm);
      setCreateModalOpen(false);
      setFeedback({ type: 'success', message: 'Obra criada com sucesso.' });
      await load(currentTab.key);
    } catch (error) {
      console.error('Erro ao criar obra', error);
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
    } catch (error) {
      console.error('Erro ao salvar atualização', error);
      setFeedback({ type: 'error', message: 'Não foi possível salvar a atualização.' });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleSaveCompletionDate = async (artwork, date) => {
    if (!currentTab || isSavingCompletionId) return;

    setIsSavingCompletionId(artwork.id);
    setFeedback({ type: '', message: '' });

    try {
      await paintingsApi.updateCompletionDate(artwork.id, {
        finished_at: date || null,
      });

      setFeedback({ type: 'success', message: 'Data de conclusão salva.' });
      await load(currentTab.key);
    } catch (error) {
      console.error('Erro ao salvar conclusão', error);
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
    } catch (error) {
      console.error('Erro ao excluir obra', error);
      setFeedback({ type: 'error', message: 'Não foi possível excluir a obra.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const openGallery = async (artwork) => {
    if (!artwork) return;
    setFeedback({ type: '', message: '' });

    try {
      const response = await paintingsApi.listUpdates(artwork.id);
      setGalleryArtwork({
        ...artwork,
        updates: response?.data?.data || [],
      });
    } catch (error) {
      console.error('Erro ao abrir galeria', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar a galeria da obra.' });
    }
  };

  const loadInsights = async (category = currentTab?.key) => {
    if (!category) return;

    setInsightsLoading(true);
    try {
      const [insightsResponse, logResponse] = await Promise.all([
        paintingsApi.getInsights(category),
        paintingsApi.getLog(category, 40),
      ]);
      setInsightsData(insightsResponse?.data?.data || null);
      setLogData(logResponse?.data?.data || []);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (insightsOpen) {
      loadInsights(currentTab?.key);
    }
  }, [insightsOpen, currentTab]);

  const activeArtworks = useMemo(() => artworks.filter((artwork) => !isCompletedArtwork(artwork)), [artworks]);
  const completedArtworks = useMemo(() => artworks.filter(isCompletedArtwork), [artworks]);
  const featuredArtwork = activeArtworks[0] || artworks[0] || null;

  return (
    <div className="page-container fade-in visual-arts-page">
      <header className="visual-arts-header">
        <div className="visual-arts-header-copy">
          <h1>Artes Visuais</h1>
        </div>

        <div className="visual-arts-header-controls">
          <div className="visual-arts-mode-toggle">
            <button type="button" className={uiMode === 'view' ? 'active' : ''} onClick={() => setUiMode('view')}>
              Exibição
            </button>
            <button type="button" className={uiMode === 'edit' ? 'active' : ''} onClick={() => setUiMode('edit')}>
              Edição
            </button>
          </div>

          {uiMode === 'edit' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setInsightsOpen(true)}
            >
              <BarChart3 size={16} /> Log e estatísticas
            </button>
          ) : null}

          {usesCardFlow && uiMode === 'edit' ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setForm(initialForm);
                setCreateModalOpen(true);
              }}
            >
              <Plus size={16} /> Nova obra
            </button>
          ) : null}
        </div>
      </header>

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

      {feedback.message ? <div className={`visual-arts-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      {usesCardFlow ? (
        <>
          {featuredArtwork ? (
            <section className="visual-arts-spotlight page-shell">
              <div className="visual-arts-spotlight-media">
                <ArtworkCard
                  artwork={featuredArtwork}
                  uiMode="view"
                  onOpenGallery={openGallery}
                  onOpenUpdate={(artwork) => {
                    setSelectedArtwork(artwork);
                    setUpdateModalOpen(true);
                  }}
                  onSaveCompletionDate={handleSaveCompletionDate}
                  onDelete={setPendingDeleteArtwork}
                  isSavingCompletion={isSavingCompletionId === featuredArtwork.id}
                />
              </div>

              <div className="visual-arts-spotlight-copy">
                <h2>{featuredArtwork.title}</h2>
                <div className="visual-arts-spotlight-meta">
                  {featuredArtwork.started_at ? (
                    <span>
                      <CalendarRange size={14} /> {formatDate(featuredArtwork.started_at)}
                    </span>
                  ) : null}
                </div>

                <div className="visual-arts-spotlight-actions">
                  {uiMode === 'edit' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setSelectedArtwork(featuredArtwork);
                        setUpdateModalOpen(true);
                      }}
                    >
                      <PencilLine size={15} /> Atualizar
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <section className="visual-arts-empty-state page-shell">
              <div className="visual-arts-empty-state__copy">
                <span className="visual-kicker">Vazio</span>
                <p>Nenhuma obra cadastrada ainda.</p>
              </div>
              {uiMode === 'edit' ? (
                <button className="btn btn-primary" type="button" onClick={() => setCreateModalOpen(true)}>
                  <ImagePlus size={16} /> Criar primeira obra
                </button>
              ) : null}
            </section>
          )}

          {activeArtworks.length ? (
            <section className="visual-arts-section">
              <div className="visual-arts-section-head">
                <div>
                  <span className="visual-kicker">Obras</span>
                  <h3>Em andamento</h3>
                </div>
              </div>

              <div className="visual-arts-grid">
                {activeArtworks.map((artwork) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    uiMode={uiMode}
                    onOpenGallery={openGallery}
                    onOpenUpdate={(selected) => {
                      setSelectedArtwork(selected);
                      setUpdateModalOpen(true);
                    }}
                    onSaveCompletionDate={handleSaveCompletionDate}
                    onDelete={setPendingDeleteArtwork}
                    isSavingCompletion={isSavingCompletionId === artwork.id}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {completedArtworks.length ? (
            <section className="visual-arts-section">
              <div className="visual-arts-section-head">
                <div>
                  <span className="visual-kicker">Arquivo</span>
                  <h3>Concluídas</h3>
                </div>
              </div>

              <div className="visual-arts-grid is-completed">
                {completedArtworks.map((artwork) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    uiMode={uiMode}
                    onOpenGallery={openGallery}
                    onOpenUpdate={(selected) => {
                      setSelectedArtwork(selected);
                      setUpdateModalOpen(true);
                    }}
                    onSaveCompletionDate={handleSaveCompletionDate}
                    onDelete={setPendingDeleteArtwork}
                    isSavingCompletion={isSavingCompletionId === artwork.id}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {isLoading ? <div className="visual-arts-empty-state page-shell">Carregando obras...</div> : null}

          {createModalOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card visual-create-modal">
                <div className="visual-modal-head">
                  <div>
                    <span className="visual-kicker">Nova obra</span>
                    <h2>{currentTab?.label}</h2>
                  </div>
                </div>

                <form onSubmit={handleCreateArtwork} className="modal-form visual-modal-form">
                  <label>
                    Título
                    <input
                      className="input"
                      value={form.title}
                      onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    Tamanho
                    <input
                      className="input"
                      value={form.size}
                      onChange={(event) => setForm((previous) => ({ ...previous, size: event.target.value }))}
                      placeholder="Ex.: 50 x 70 cm"
                    />
                  </label>

                  <label>
                    Referência
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      required={sharedArtworkFlow.has(currentTab?.key || '')}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, referenceFile: event.target.files?.[0] || null }))
                      }
                    />
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setCreateModalOpen(false)}>
                      Cancelar
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={isSubmittingCreate}>
                      {isSubmittingCreate ? 'Criando...' : 'Criar obra'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

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

          <ArtworkGalleryModal artwork={galleryArtwork} open={!!galleryArtwork} onClose={() => setGalleryArtwork(null)} />

          {insightsOpen ? (
            <div className="modal-backdrop" onClick={() => setInsightsOpen(false)}>
              <div className="modal-card visual-insights-modal" onClick={(event) => event.stopPropagation()}>
                <div className="visual-modal-head">
                  <div>
                    <span className="visual-kicker">Módulo</span>
                    <h2>Log e estatísticas</h2>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setInsightsOpen(false)}>
                    Fechar
                  </button>
                </div>

                {insightsLoading ? <div className="visual-empty-state page-shell">Carregando...</div> : null}

                {!insightsLoading && insightsData ? (
                  <div className="visual-insights-layout">
                    <section className="visual-insights-summary">
                      <div className="visual-insight-pill page-shell">
                        <span>Obras</span>
                        <strong>{insightsData.total_artworks || 0}</strong>
                      </div>
                      <div className="visual-insight-pill page-shell">
                        <span>Registros</span>
                        <strong>{insightsData.total_updates || 0}</strong>
                      </div>
                      <div className="visual-insight-pill page-shell">
                        <span>Concluídas</span>
                        <strong>{insightsData.completed_artworks || 0}</strong>
                      </div>
                      <div className="visual-insight-pill page-shell">
                        <span>Média/obra</span>
                        <strong>{Number(insightsData.avg_updates_per_artwork || 0).toFixed(1)}</strong>
                      </div>
                    </section>

                    <section className="visual-insights-panel page-shell">
                      <div className="visual-arts-section-head">
                        <div>
                          <span className="visual-kicker">Fluxo</span>
                          <h3>Panorama</h3>
                        </div>
                      </div>

                      <div className="visual-stats-list">
                        <div className="visual-stat-row">
                          <span>Ativas</span>
                          <strong>{insightsData.active_artworks || 0}</strong>
                        </div>
                        <div className="visual-stat-row">
                          <span>Concluídas no mês</span>
                          <strong>{insightsData.completions_this_month || 0}</strong>
                        </div>
                        <div className="visual-stat-row">
                          <span>Registros no mês</span>
                          <strong>{insightsData.updates_this_month || 0}</strong>
                        </div>
                        <div className="visual-stat-row">
                          <span>Pastas</span>
                          <strong>{insightsData.total_folders || 0}</strong>
                        </div>
                        <div className="visual-stat-row">
                          <span>Imagens no acervo</span>
                          <strong>{insightsData.total_media_items || 0}</strong>
                        </div>
                      </div>
                    </section>

                    <section className="visual-insights-panel page-shell">
                      <div className="visual-arts-section-head">
                        <div>
                          <span className="visual-kicker">Recente</span>
                          <h3>Movimento</h3>
                        </div>
                        <small>{logData.length}</small>
                      </div>

                      <div className="visual-log-list glass-scrollbar">
                        {logData.length ? (
                          logData.map((row) => (
                            <div key={`${row.event_type}-${row.event_id}`} className="visual-log-row">
                              <div className={`visual-log-dot is-${row.event_type}`} />
                              <div className="visual-log-copy">
                                <div className="visual-log-topline">
                                  <strong>{row.title}</strong>
                                  <span>{formatDateTime(row.occurred_at)}</span>
                                </div>
                                <p>{logLabelByType[row.event_type] || row.event_type}</p>
                                {row.detail ? <small>{row.detail}</small> : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="visual-empty-inline">Nenhum movimento registrado ainda.</p>
                        )}
                      </div>
                    </section>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {pendingDeleteArtwork ? (
            <div className="modal-backdrop" onClick={() => !isDeleting && setPendingDeleteArtwork(null)}>
              <div
                className="modal-card visual-delete-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-artwork-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="visual-modal-head">
                  <div>
                    <span className="visual-kicker">Excluir</span>
                    <h2 id="delete-artwork-title">{pendingDeleteArtwork.title}</h2>
                  </div>
                </div>

                <p className="visual-delete-copy">Esta obra e os registros visuais dela serão removidos.</p>

                <div className="modal-actions">
                  <button
                    ref={cancelDeleteRef}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setPendingDeleteArtwork(null)}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteArtwork} disabled={isDeleting}>
                    <Trash2 size={15} /> {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <MediaFolderSection category={currentTab?.key || 'outros'} title={currentTab?.label || 'Outros'} uiMode={uiMode} />
      )}
    </div>
  );
};

export default HobbyVisualArts;
