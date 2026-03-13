import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Edit3,
  Film,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Tv,
  Video,
} from 'lucide-react';
import { watchApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './Watch.css';

const MEDIA_OPTIONS = [
  { value: 'all', label: 'Tudo', icon: Clapperboard },
  { value: 'movie', label: 'Filmes', icon: Film },
  { value: 'series', label: 'Séries', icon: Tv },
  { value: 'anime', label: 'Anime', icon: PlayCircle },
  { value: 'video_long', label: 'Vídeo longo', icon: Video },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'watching', label: 'Assistindo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'rewatch', label: 'Rever' },
  { value: 'backlog', label: 'Na lista' },
  { value: 'completed', label: 'Concluído' },
  { value: 'dropped', label: 'Dropado' },
];

const LOG_ACTION_OPTIONS = [
  { value: 'progress', label: 'Registrar progresso' },
  { value: 'completed', label: 'Marcar como concluído' },
  { value: 'paused', label: 'Pausar' },
  { value: 'rewatch', label: 'Entrar em modo rever' },
  { value: 'dropped', label: 'Dropar' },
];

const EMPTY_ITEM_FORM = {
  category_id: '',
  name: '',
  media_type: 'movie',
  status: 'backlog',
  description: '',
  watch_with: '',
  total_seasons: '',
  total_episodes: '',
  current_season: '',
  current_episode: '',
  image: null,
};

const EMPTY_LOG_FORM = {
  action: 'progress',
  season_number: '',
  episode_number: '',
  note: '',
};

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Watch() {
  const [overview, setOverview] = useState({ items: [], recent_logs: [], categories: [], stats: { by_status: {}, by_type: {}, active_items: 0, total_items: 0 } });
  const [mediaFilter, setMediaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [editingItem, setEditingItem] = useState(null);
  const [activeLogItem, setActiveLogItem] = useState(null);
  const [logForm, setLogForm] = useState(EMPTY_LOG_FORM);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const response = await watchApi.getOverview();
      setOverview(response.data.data || { items: [], recent_logs: [], categories: [], stats: { by_status: {}, by_type: {}, active_items: 0, total_items: 0 } });
    } catch (error) {
      console.error('Erro ao carregar Assistir:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o módulo Assistir.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const filteredItems = useMemo(() => {
    const token = searchTerm.trim().toLowerCase();
    return (overview.items || []).filter((item) => {
      if (mediaFilter !== 'all' && item.media_type !== mediaFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!token) return true;
      return [item.name, item.description, item.category_name, item.watch_with]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(token));
    });
  }, [overview.items, mediaFilter, searchTerm, statusFilter]);

  const spotlightItems = filteredItems.filter((item) => ['watching', 'paused', 'rewatch'].includes(item.status));
  const libraryItems = filteredItems.filter((item) => !['watching', 'paused', 'rewatch'].includes(item.status));

  const episodicLog = activeLogItem?.is_episodic;
  const episodicItemForm = ['series', 'anime'].includes(itemForm.media_type);

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      ...EMPTY_ITEM_FORM,
      category_id: overview.categories?.[0]?.id ? String(overview.categories[0].id) : '',
    });
    setShowItemModal(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      category_id: item.category_id ? String(item.category_id) : '',
      name: item.name || '',
      media_type: item.media_type || 'movie',
      status: item.status || 'backlog',
      description: item.description || '',
      watch_with: item.watch_with || '',
      total_seasons: item.total_seasons ?? '',
      total_episodes: item.total_episodes ?? '',
      current_season: item.current_season ?? '',
      current_episode: item.current_episode ?? '',
      image: null,
    });
    setShowItemModal(true);
  };

  const openLogModal = (item) => {
    setActiveLogItem(item);
    setLogForm({
      ...EMPTY_LOG_FORM,
      season_number: item.current_season || '',
      episode_number: item.current_episode || '',
    });
    setShowLogModal(true);
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await watchApi.createCategory(categoryName.trim());
      setCategoryName('');
      setShowCategoryModal(false);
      setFeedback({ type: 'success', message: 'Coleção criada com sucesso.' });
      await loadOverview();
    } catch (error) {
      console.error('Erro ao criar coleção:', error);
      setFeedback({ type: 'error', message: 'Erro ao criar coleção.' });
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return;

    const payload = {
      ...itemForm,
      category_id: itemForm.category_id || undefined,
      image: itemForm.image || undefined,
    };

    try {
      if (editingItem) {
        await watchApi.updateItem(editingItem.id, payload);
        setFeedback({ type: 'success', message: 'Item atualizado.' });
      } else {
        await watchApi.createItem(payload);
        setFeedback({ type: 'success', message: 'Item adicionado ao Assistir.' });
      }
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm(EMPTY_ITEM_FORM);
      await loadOverview();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar item.' });
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Remover "${item.name}" do módulo Assistir?`)) return;
    try {
      await watchApi.deleteItem(item.id);
      setFeedback({ type: 'success', message: 'Item removido.' });
      await loadOverview();
    } catch (error) {
      console.error('Erro ao remover item:', error);
      setFeedback({ type: 'error', message: 'Erro ao remover item.' });
    }
  };

  const handleQuickComplete = async (itemId) => {
    try {
      await watchApi.addLog(itemId, { action: 'completed' });
      setFeedback({ type: 'success', message: 'Item marcado como concluído.' });
      await loadOverview();
    } catch (error) {
      console.error('Erro ao concluir item:', error);
      setFeedback({ type: 'error', message: 'Erro ao concluir item.' });
    }
  };

  const handleSaveLog = async () => {
    if (!activeLogItem) return;
    try {
      await watchApi.addLog(activeLogItem.id, {
        action: logForm.action,
        season_number: episodicLog && logForm.season_number !== '' ? Number(logForm.season_number) : null,
        episode_number: episodicLog && logForm.episode_number !== '' ? Number(logForm.episode_number) : null,
        note: logForm.note || null,
      });
      setShowLogModal(false);
      setActiveLogItem(null);
      setLogForm(EMPTY_LOG_FORM);
      setFeedback({ type: 'success', message: 'Log registrado.' });
      await loadOverview();
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      setFeedback({ type: 'error', message: 'Erro ao registrar log.' });
    }
  };

  const statusCount = overview.stats?.by_status || {};

  return (
    <section className="watch-page">
      <div className="page-container fade-in">
        <div className="watch-container">
          <header className="watch-header">
            <div>
              <h1>Assistir</h1>
            </div>
            <div className="watch-header-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
                <Plus size={16} /> Nova coleção
              </button>
              <button type="button" className="btn btn-primary" onClick={openCreateItem}>
                <Plus size={16} /> Novo item
              </button>
            </div>
          </header>

          {feedback.message ? <div className={`watch-feedback ${feedback.type}`}>{feedback.message}</div> : null}

          <div className="watch-toolbar">
            <div className="watch-search">
              <Search size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por título, descrição, coleção..."
              />
            </div>
            <div className="watch-filter-row">
              {MEDIA_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`watch-chip ${mediaFilter === option.value ? 'active' : ''}`}
                    onClick={() => setMediaFilter(option.value)}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="watch-select-row">
              <label>
                Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="watch-empty">
              <p>Carregando módulo Assistir...</p>
            </div>
          ) : (
            <div className="watch-layout">
              <div className="watch-main">
                {spotlightItems.length > 0 && (
                  <section className="watch-section">
                    <div className="watch-section-head">
                      <div>
                        <span className="watch-section-kicker">Agora</span>
                        <h2>Em foco</h2>
                      </div>
                      <small>{spotlightItems.length} item(ns)</small>
                    </div>
                    <div className="watch-grid">
                      {spotlightItems.map((item) => (
                        <article key={item.id} className="watch-card">
                          <div className="watch-cover">
                            {item.image_path ? (
                              <img src={resolveMediaUrl(item.image_path)} alt={item.name} />
                            ) : (
                              <div className="watch-cover-fallback">{item.media_type_label}</div>
                            )}
                          </div>
                          <div className="watch-card-body">
                            <div className="watch-pill-row">
                              <span className={`watch-pill watch-pill-type ${item.media_type}`}>{item.media_type_label}</span>
                              <span className={`watch-pill watch-pill-status ${item.status}`}>{item.status_label}</span>
                            </div>
                            <h3>{item.name}</h3>
                            {item.description ? <p>{item.description}</p> : null}
                            <div className="watch-meta-row">
                              {item.progress_label ? <span>{item.progress_label}</span> : <span>{item.category_name || 'Sem coleção'}</span>}
                              {item.watch_with ? <span>Com {item.watch_with}</span> : null}
                            </div>
                            {typeof item.progress_percent === 'number' ? (
                              <div className="watch-progress">
                                <div style={{ width: `${item.progress_percent}%` }} />
                              </div>
                            ) : null}
                            {item.last_log_summary ? (
                              <small>{item.last_log_summary}</small>
                            ) : item.started_at ? (
                              <small>Em andamento desde {formatDate(item.started_at)}</small>
                            ) : (
                              <small>{item.category_name || 'Sem coleção definida'}</small>
                            )}
                          </div>
                          <div className="watch-card-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => openLogModal(item)}>
                              <CalendarClock size={15} /> Log
                            </button>
                            <button type="button" className="icon-glass-button" onClick={() => openEditItem(item)}>
                              <Edit3 size={15} />
                            </button>
                            {item.status !== 'completed' ? (
                              <button type="button" className="icon-glass-button success" onClick={() => handleQuickComplete(item.id)}>
                                <CheckCircle2 size={15} />
                              </button>
                            ) : null}
                            <button type="button" className="icon-glass-button danger" onClick={() => handleDeleteItem(item)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

              <section className="watch-section">
                <div className="watch-section-head">
                  <div>
                    <span className="watch-section-kicker">Biblioteca</span>
                    <h2>{mediaFilter === 'all' ? 'Tudo que está no radar' : MEDIA_OPTIONS.find((option) => option.value === mediaFilter)?.label}</h2>
                  </div>
                  <small>{filteredItems.length} resultado(s)</small>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="watch-empty">
                    <p>Nenhum item encontrado para esse filtro.</p>
                    <button type="button" className="btn btn-primary" onClick={openCreateItem}>
                      <Plus size={16} /> Adicionar ao Assistir
                    </button>
                  </div>
                ) : (
                  <div className="watch-grid compact">
                    {(spotlightItems.length > 0 ? libraryItems : filteredItems).map((item) => (
                      <article key={item.id} className="watch-card compact">
                        <div className="watch-cover compact">
                          {item.image_path ? (
                            <img src={resolveMediaUrl(item.image_path)} alt={item.name} />
                          ) : (
                            <div className="watch-cover-fallback">{item.media_type_label}</div>
                          )}
                        </div>
                        <div className="watch-card-body">
                          <div className="watch-pill-row">
                            <span className={`watch-pill watch-pill-type ${item.media_type}`}>{item.media_type_label}</span>
                            <span className={`watch-pill watch-pill-status ${item.status}`}>{item.status_label}</span>
                          </div>
                          <h3>{item.name}</h3>
                          {item.description ? <p>{item.description}</p> : null}
                          <div className="watch-meta-row">
                            {item.progress_label ? <span>{item.progress_label}</span> : <span>{item.category_name || 'Sem coleção'}</span>}
                            {item.watch_with ? <span>Com {item.watch_with}</span> : null}
                          </div>
                          {item.last_logged_at ? (
                            <small>Último movimento: {formatDate(item.last_logged_at)}</small>
                          ) : item.completed_at ? (
                            <small>Concluído em {formatDate(item.completed_at)}</small>
                          ) : (
                            <small>{item.category_name || 'Sem coleção definida'}</small>
                          )}
                        </div>
                        <div className="watch-card-actions">
                          <button type="button" className="btn btn-secondary" onClick={() => openLogModal(item)}>
                            <CalendarClock size={15} /> Log
                          </button>
                          <button type="button" className="icon-glass-button" onClick={() => openEditItem(item)}>
                            <Edit3 size={15} />
                          </button>
                          {item.status !== 'completed' ? (
                            <button type="button" className="icon-glass-button success" onClick={() => handleQuickComplete(item.id)}>
                              <CheckCircle2 size={15} />
                            </button>
                          ) : (
                            <button type="button" className="icon-glass-button" onClick={() => openLogModal(item)}>
                              <RotateCcw size={15} />
                            </button>
                          )}
                          <button type="button" className="icon-glass-button danger" onClick={() => handleDeleteItem(item)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="watch-side">
              <div className="watch-section-head side">
                <div>
                  <span className="watch-section-kicker">Recente</span>
                  <h2>Últimos movimentos</h2>
                  <small>Log textual do que foi assistido ou atualizado.</small>
                </div>
              </div>
              <div className="watch-log-list">
                {(overview.recent_logs || []).length === 0 ? (
                  <p className="watch-log-empty">Ainda não há registros de consumo.</p>
                ) : (
                  overview.recent_logs.map((entry) => (
                    <div key={entry.id} className="watch-log-row">
                      <div className={`watch-log-dot ${entry.media_type}`} />
                      <div>
                        <strong>{entry.summary}</strong>
                        {entry.note ? <p>{entry.note}</p> : null}
                        <span>{formatDateTime(entry.logged_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}
        </div>
      </div>

      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content watch-modal">
            <h3>Nova coleção</h3>
            <p>Use coleções para agrupar itens além do tipo de mídia.</p>
            <input
              type="text"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Ex: Com alguém, Clássicos, YouTube"
              className="input"
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCategoryModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreateCategory}>
                Criar coleção
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content watch-modal wide">
            <h3>{editingItem ? 'Editar item' : 'Novo item'}</h3>
            <div className="watch-form-grid">
              <label>
                Título
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="input"
                />
              </label>
              <label>
                Coleção
                <select
                  value={itemForm.category_id}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, category_id: event.target.value }))}
                  className="input"
                >
                  <option value="">Geral</option>
                  {(overview.categories || []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={itemForm.media_type}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, media_type: event.target.value }))}
                  className="input"
                >
                  {MEDIA_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={itemForm.status}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="input"
                >
                  {STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Com alguém
                <input
                  type="text"
                  value={itemForm.watch_with}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, watch_with: event.target.value }))}
                  className="input"
                  placeholder="Nome opcional"
                />
              </label>
              <label>
                Capa
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setItemForm((prev) => ({ ...prev, image: event.target.files?.[0] || null }))}
                  className="input"
                />
              </label>
              {episodicItemForm ? (
                <>
                  <label>
                    Total de temporadas
                    <input
                      type="number"
                      min="0"
                      value={itemForm.total_seasons}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, total_seasons: event.target.value }))}
                      className="input"
                    />
                  </label>
                  <label>
                    Total de episódios
                    <input
                      type="number"
                      min="0"
                      value={itemForm.total_episodes}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, total_episodes: event.target.value }))}
                      className="input"
                    />
                  </label>
                  <label>
                    Temporada atual
                    <input
                      type="number"
                      min="0"
                      value={itemForm.current_season}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, current_season: event.target.value }))}
                      className="input"
                    />
                  </label>
                  <label>
                    Episódio atual
                    <input
                      type="number"
                      min="0"
                      value={itemForm.current_episode}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, current_episode: event.target.value }))}
                      className="input"
                    />
                  </label>
                </>
              ) : null}
              <label className="full">
                Descrição
                <textarea
                  rows={4}
                  value={itemForm.description}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="input"
                  placeholder="Uma nota curta sobre o que é ou por que está aqui."
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowItemModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveItem}>
                {editingItem ? 'Salvar alterações' : 'Criar item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogModal && activeLogItem && (
        <div className="modal-overlay">
          <div className="modal-content watch-modal">
            <h3>Registrar movimento</h3>
            <p>{activeLogItem.name}</p>
            {activeLogItem.progress_label ? (
              <div className="watch-log-context">
                <span>{activeLogItem.media_type_label}</span>
                <strong>{activeLogItem.progress_label}</strong>
              </div>
            ) : null}
            <label>
              Ação
              <select
                value={logForm.action}
                onChange={(event) => setLogForm((prev) => ({ ...prev, action: event.target.value }))}
                className="input"
              >
                {LOG_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {episodicLog ? (
              <div className="watch-form-grid compact">
                <label>
                  Temporada
                  <input
                    type="number"
                    min="0"
                    value={logForm.season_number}
                    onChange={(event) => setLogForm((prev) => ({ ...prev, season_number: event.target.value }))}
                    className="input"
                  />
                </label>
                <label>
                  Episódio
                  <input
                    type="number"
                    min="0"
                    value={logForm.episode_number}
                    onChange={(event) => setLogForm((prev) => ({ ...prev, episode_number: event.target.value }))}
                    className="input"
                  />
                </label>
              </div>
            ) : null}
            <label>
              Nota
              <textarea
                rows={4}
                value={logForm.note}
                onChange={(event) => setLogForm((prev) => ({ ...prev, note: event.target.value }))}
                className="input"
                placeholder="Opcional. Ex: vi com fulano, episódio ótimo, pausar por enquanto..."
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowLogModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveLog}>
                Salvar log
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
