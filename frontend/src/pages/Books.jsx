import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Clock3,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { booksApi } from '../services/api';
import './Books.css';

const EMPTY_FORM = {
  title: '',
  total_pages: '',
  cover_image: '',
  book_type: 'Livro',
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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildFallbackLabel = (title) => {
  const words = (title || 'Livro').trim().split(/\s+/).slice(0, 2);
  return words.join(' ');
};

const getProgressPercent = (book) => {
  const total = Number(book.total_pages) || 0;
  const current = Number(book.current_page) || 0;
  if (!total) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
};

const getStatusLabel = (book) => {
  if (book.status === 'concluido') return 'Concluído';
  if ((book.current_page || 0) > 0) return 'Lendo';
  return 'Na estante';
};

const sortReadingBooks = (items) => [...items].sort((left, right) => {
  const leftPercent = getProgressPercent(left);
  const rightPercent = getProgressPercent(right);
  return rightPercent - leftPercent || (right.current_page || 0) - (left.current_page || 0) || left.title.localeCompare(right.title);
});

const sortFinishedBooks = (items) => [...items].sort((left, right) => {
  return (right.finished_at || '').localeCompare(left.finished_at || '') || left.title.localeCompare(right.title);
});

const BookCard = ({ book, onOpenUpdate, onDelete, removeMode, uiMode }) => {
  const percent = getProgressPercent(book);
  const totalPages = Number(book.total_pages) || 0;
  const currentPages = Number(book.current_page) || 0;
  const finished = book.status === 'concluido';

  return (
    <article
      className={`reading-card ${removeMode ? 'remove-mode' : ''} is-${uiMode}`}
      onClick={() => {
        if (removeMode) {
          onDelete(book);
          return;
        }
        if (!finished) {
          onOpenUpdate(book);
        }
      }}
    >
      <div className="reading-card-cover-shell">
        {book.cover_image ? (
          <img src={book.cover_image} alt={book.title} className="reading-card-cover" />
        ) : (
          <div className="reading-card-fallback">
            <span>{buildFallbackLabel(book.title)}</span>
          </div>
        )}

        <div className="reading-card-topline">
          <span className="reading-card-type">{book.book_type_name || book.book_type || 'Livro'}</span>
          <span className={`reading-card-status is-${finished ? 'done' : currentPages > 0 ? 'reading' : 'shelf'}`}>
            {getStatusLabel(book)}
          </span>
        </div>

        <div className="reading-card-overlay">
          <div className="reading-card-copy">
            <strong>{book.title}</strong>
            <span>
              {totalPages ? `${currentPages}/${totalPages} páginas` : `${currentPages} páginas`}
            </span>
          </div>
        </div>

        <div className="reading-card-progress">
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>

      {uiMode === 'edit' ? (
        <div className="reading-card-meta">
          <div className="reading-card-meta-copy">
            <strong>{book.title}</strong>
            <span>{book.book_type_name || book.book_type || 'Livro'}</span>
            {book.started_at || book.finished_at ? (
              <div className="reading-card-date-row">
                {book.started_at ? <span>Início {formatDate(book.started_at)}</span> : null}
                {book.finished_at ? <span>Fim {formatDate(book.finished_at)}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="reading-card-meta-side">
            <span>{getStatusLabel(book)}</span>
            <strong>{totalPages ? `${currentPages}/${totalPages}` : `${currentPages} págs`}</strong>
          </div>
        </div>
      ) : null}
    </article>
  );
};

const Books = () => {
  const [uiMode, setUiMode] = useState('view');
  const [books, setBooks] = useState([]);
  const [types, setTypes] = useState([]);
  const [readingStats, setReadingStats] = useState({
    total_books: 0,
    status_counts: {},
    pages_this_month: 0,
    total_sessions: 0,
    avg_pages_per_session: 0,
    sessions_this_month: 0,
    avg_pages_per_session_month: 0,
  });
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [newType, setNewType] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [activeBook, setActiveBook] = useState(null);
  const [targetPage, setTargetPage] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [logData, setLogData] = useState([]);
  const [statsByType, setStatsByType] = useState({ monthly: [], yearly: [], daily_average: [], month: null, year: null });
  const [removeMode, setRemoveMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [booksRes, typesRes, statsRes] = await Promise.all([
        booksApi.list(),
        booksApi.listTypes(),
        booksApi.stats(),
      ]);
      setBooks(booksRes.data.data || []);
      setTypes(typesRes.data.data || []);
      setReadingStats(statsRes.data.data || {
        total_books: 0,
        status_counts: {},
        pages_this_month: 0,
        total_sessions: 0,
        avg_pages_per_session: 0,
        sessions_this_month: 0,
        avg_pages_per_session_month: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const [logRes, statsRes] = await Promise.all([booksApi.getLog(40), booksApi.getStatsByType()]);
      setLogData(logRes.data.data || []);
      setStatsByType(statsRes.data.data || { monthly: [], yearly: [], daily_average: [], month: null, year: null });
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (uiMode === 'view') {
      setRemoveMode(false);
    }
  }, [uiMode]);

  const availableTypes = useMemo(() => {
    const fromBooks = books.map((book) => book.book_type_name || book.book_type).filter(Boolean);
    const fromTypes = types.map((type) => type.name).filter(Boolean);
    return [...new Set([...fromBooks, ...fromTypes])].sort((left, right) => left.localeCompare(right));
  }, [books, types]);

  const visibleBooks = useMemo(() => {
    if (typeFilter === 'all') return books;
    return books.filter((book) => (book.book_type_name || book.book_type || 'Livro') === typeFilter);
  }, [books, typeFilter]);

  const readingNow = useMemo(
    () => sortReadingBooks(visibleBooks.filter((book) => book.status !== 'concluido' && (book.current_page || 0) > 0)),
    [visibleBooks],
  );

  const shelfBooks = useMemo(
    () => visibleBooks.filter((book) => book.status !== 'concluido' && (book.current_page || 0) === 0).sort((left, right) => left.title.localeCompare(right.title)),
    [visibleBooks],
  );

  const finishedBooks = useMemo(
    () => sortFinishedBooks(visibleBooks.filter((book) => book.status === 'concluido')),
    [visibleBooks],
  );

  const spotlightBook = readingNow[0] || null;
  const spotlightProgress = spotlightBook ? getProgressPercent(spotlightBook) : 0;
  const monthlyMax = useMemo(
    () => Math.max(1, ...(statsByType.monthly || []).map((row) => Number(row.total_pages) || 0)),
    [statsByType.monthly],
  );
  const dailyAverageByType = useMemo(
    () => Object.fromEntries((statsByType.daily_average || []).map((row) => [row.book_type, row])),
    [statsByType.daily_average],
  );
  const yearlyHighlights = useMemo(
    () => (statsByType.yearly || []).slice(0, 3),
    [statsByType.yearly],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    await booksApi.create({
      title: form.title.trim(),
      total_pages: Number(form.total_pages) || 0,
      cover_image: form.cover_image.trim(),
      book_type: form.book_type || 'Livro',
    });

    setForm(EMPTY_FORM);
    setCreateModalOpen(false);
    setFeedback({ type: 'success', message: 'Livro adicionado à estante.' });
    await load();
  };

  const handleCreateType = async () => {
    if (!newType.trim()) return;
    await booksApi.createType({ name: newType.trim() });
    setForm((previous) => ({ ...previous, book_type: newType.trim() }));
    setNewType('');
    await load();
  };

  const openUpdate = (book) => {
    setActiveBook(book);
    setTargetPage(book.current_page || 0);
  };

  const closeUpdate = () => {
    setActiveBook(null);
    setTargetPage(0);
  };

  const handleSaveProgress = async () => {
    if (!activeBook) return;
    const current = activeBook.current_page || 0;
    const nextTarget = Number(targetPage) || 0;
    const pagesRead = Math.max(0, nextTarget - current);

    if (pagesRead === 0) {
      closeUpdate();
      return;
    }

    await booksApi.addSession(activeBook.id, {
      pages_read: pagesRead,
      read_at: new Date().toISOString(),
    });

    setFeedback({ type: 'success', message: 'Progresso registrado.' });
    closeUpdate();
    await load();
  };

  const handleDelete = async (book) => {
    const confirmed = window.confirm(`Remover "${book.title}" da estante?`);
    if (!confirmed) return;
    await booksApi.delete(book.id);
    setFeedback({ type: 'success', message: 'Livro removido.' });
    await load();
  };

  const openInsights = async () => {
    setInsightsOpen(true);
    await loadInsights();
  };

  return (
    <div className="page-container fade-in books-page">
      <header className="books-header">
        <div className="books-header-copy">
          <h1>Leitura</h1>
        </div>

        <div className="books-header-controls">
          <div className="books-mode-toggle">
            <button
              type="button"
              className={uiMode === 'view' ? 'active' : ''}
              onClick={() => setUiMode('view')}
            >
              Exibição
            </button>
            <button
              type="button"
              className={uiMode === 'edit' ? 'active' : ''}
              onClick={() => setUiMode('edit')}
            >
              Edição
            </button>
          </div>

          {uiMode === 'edit' ? (
            <div className="books-actions">
              <button className="btn btn-secondary" type="button" onClick={openInsights}>
                <ScrollText size={16} /> Log e estatísticas
              </button>
              <button className={`btn ${removeMode ? 'btn-danger' : 'btn-secondary'}`} type="button" onClick={() => setRemoveMode((previous) => !previous)}>
                <Trash2 size={16} /> {removeMode ? 'Sair da remoção' : 'Remover livro'}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setCreateModalOpen(true)}>
                <Plus size={16} /> Novo livro
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {feedback.message ? <div className={`books-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      {loading ? <div className="books-loading page-shell">Carregando estante...</div> : null}

      {!loading ? (
        <>
          <section className="books-spotlight page-shell">
            {spotlightBook ? (
              <>
                <div className="books-spotlight-cover">
                  {spotlightBook.cover_image ? (
                    <img src={spotlightBook.cover_image} alt={spotlightBook.title} className="books-spotlight-image" />
                  ) : (
                    <div className="books-spotlight-fallback">{buildFallbackLabel(spotlightBook.title)}</div>
                  )}
                </div>

                <div className="books-spotlight-content">
                  <span className="books-kicker">Em leitura</span>
                  <h2>{spotlightBook.title}</h2>
                  <div className="books-spotlight-meta">
                    <span><Bookmark size={14} /> {spotlightBook.book_type_name || spotlightBook.book_type || 'Livro'}</span>
                    <span><Clock3 size={14} /> {spotlightBook.current_page || 0}/{spotlightBook.total_pages || 0} páginas</span>
                    {spotlightBook.started_at ? <span>Início {formatDate(spotlightBook.started_at)}</span> : null}
                  </div>
                  <div className="books-progress-bar">
                    <div style={{ width: `${spotlightProgress}%` }} />
                  </div>
                  <div className="books-spotlight-actions">
                    <button className="btn btn-primary" type="button" onClick={() => openUpdate(spotlightBook)}>
                      Atualizar leitura
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="books-empty-spotlight">
                <div>
                  <span className="books-kicker">Estante</span>
                  <h2>Nenhuma leitura ativa agora.</h2>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setCreateModalOpen(true)}>
                  <Plus size={16} /> Adicionar livro
                </button>
              </div>
            )}
          </section>

          {uiMode === 'edit' ? (
            <section className="books-summary-strip">
              <div className="books-summary-card page-shell">
                <span>Na estante</span>
                <strong>{readingStats.total_books || books.length}</strong>
              </div>
              <div className="books-summary-card page-shell">
                <span>Lendo</span>
                <strong>{readingStats.status_counts?.Iniciado || readingNow.length}</strong>
              </div>
              <div className="books-summary-card page-shell">
                <span>Concluídos</span>
                <strong>{readingStats.status_counts?.Concluído || finishedBooks.length}</strong>
              </div>
              <div className="books-summary-card page-shell">
                <span>Páginas no mês</span>
                <strong>{readingStats.pages_this_month || 0}</strong>
              </div>
            </section>
          ) : null}

          <section className="books-filter-row">
            <button
              type="button"
              className={`books-filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              Tudo
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`books-filter-chip ${typeFilter === type ? 'active' : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </section>

          <section className="books-shelf-section">
            <div className="books-section-head">
              <div>
                <span className="books-kicker">Agora</span>
                <h2>Lendo</h2>
              </div>
              {uiMode === 'edit' ? <small>{readingNow.length}</small> : null}
            </div>
            {readingNow.length ? (
              <div className="books-shelf-grid">
                {readingNow.map((book) => (
                  <BookCard key={book.id} book={book} onOpenUpdate={openUpdate} onDelete={handleDelete} removeMode={removeMode} uiMode={uiMode} />
                ))}
              </div>
            ) : (
              <div className="books-empty page-shell">
                {uiMode === 'edit' ? 'Nenhum livro em andamento.' : 'Nada em leitura agora.'}
              </div>
            )}
          </section>

          <section className="books-shelf-section">
            <div className="books-section-head">
              <div>
                <span className="books-kicker">Biblioteca</span>
                <h2>Na estante</h2>
              </div>
              {uiMode === 'edit' ? <small>{shelfBooks.length}</small> : null}
            </div>
            {shelfBooks.length ? (
              <div className="books-shelf-grid">
                {shelfBooks.map((book) => (
                  <BookCard key={book.id} book={book} onOpenUpdate={openUpdate} onDelete={handleDelete} removeMode={removeMode} uiMode={uiMode} />
                ))}
              </div>
            ) : (
              <div className="books-empty page-shell">
                {uiMode === 'edit' ? 'Nenhum livro aguardando leitura.' : 'Estante vazia nesse filtro.'}
              </div>
            )}
          </section>

          {uiMode === 'edit' || finishedBooks.length ? (
            <section className="books-shelf-section">
              <div className="books-section-head">
                <div>
                  <span className="books-kicker">Arquivo</span>
                  <h2>Concluídos</h2>
                </div>
                {uiMode === 'edit' ? <small>{finishedBooks.length}</small> : null}
              </div>
              {finishedBooks.length ? (
                <div className="books-shelf-grid">
                  {finishedBooks.map((book) => (
                    <BookCard key={book.id} book={book} onOpenUpdate={openUpdate} onDelete={handleDelete} removeMode={removeMode} uiMode={uiMode} />
                  ))}
                </div>
              ) : (
                <div className="books-empty page-shell">Nenhum concluído por aqui ainda.</div>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {createModalOpen ? (
        <div className="book-modal-backdrop">
          <div className="book-modal-card">
            <h3>Novo livro</h3>
            <form className="books-form" onSubmit={handleSubmit}>
              <label>
                Título
                <input className="input" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} required />
              </label>
              <label>
                Páginas
                <input className="input" type="number" min="0" value={form.total_pages} onChange={(event) => setForm((previous) => ({ ...previous, total_pages: event.target.value }))} />
              </label>
              <label>
                Capa
                <input className="input" value={form.cover_image} onChange={(event) => setForm((previous) => ({ ...previous, cover_image: event.target.value }))} placeholder="URL da capa" />
              </label>
              <label>
                Tipo
                <select className="input" value={form.book_type} onChange={(event) => setForm((previous) => ({ ...previous, book_type: event.target.value }))}>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  {!availableTypes.length ? <option value="Livro">Livro</option> : null}
                </select>
              </label>
              <div className="books-inline-create">
                <input className="input" value={newType} onChange={(event) => setNewType(event.target.value)} placeholder="Novo tipo" />
                <button type="button" className="btn btn-secondary" onClick={handleCreateType}>
                  Criar tipo
                </button>
              </div>

              <div className="books-form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setCreateModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <BookOpen size={16} /> Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeBook ? (
        <div className="book-modal-backdrop">
          <div className="book-modal-card is-compact">
            <h3>Atualizar leitura</h3>
            <div className="books-progress-sheet">
              <div className="books-progress-book">
                <strong>{activeBook.title}</strong>
                <span>
                  {activeBook.current_page || 0}/{activeBook.total_pages || 0} páginas
                </span>
              </div>

              <input
                type="range"
                min="0"
                max={activeBook.total_pages || 0}
                value={targetPage}
                onChange={(event) => setTargetPage(Number(event.target.value))}
                className="books-progress-range"
              />

              <div className="books-progress-fields">
                <label>
                  Página atual
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max={activeBook.total_pages || undefined}
                    value={targetPage}
                    onChange={(event) => setTargetPage(Number(event.target.value))}
                  />
                </label>
                <div className="books-progress-preview page-shell">
                  <span>Registrar</span>
                  <strong>+{Math.max(0, (Number(targetPage) || 0) - (activeBook.current_page || 0))} páginas</strong>
                </div>
              </div>

              <div className="books-form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeUpdate}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveProgress}>
                  Salvar progresso
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {insightsOpen ? (
        <div className="book-modal-backdrop">
          <div className="book-modal-card is-wide">
            <div className="books-insights-head">
              <h3>Log e estatísticas</h3>
              <button className="btn btn-ghost" type="button" onClick={() => setInsightsOpen(false)}>
                Fechar
              </button>
            </div>

            {insightsLoading ? <div className="books-loading-inline">Carregando...</div> : null}

            {!insightsLoading ? (
              <div className="books-insights-layout">
                <section className="books-insights-summary">
                  <div className="books-insight-pill page-shell">
                    <span>Páginas no mês</span>
                    <strong>{readingStats.pages_this_month || 0}</strong>
                  </div>
                  <div className="books-insight-pill page-shell">
                    <span>Leituras no mês</span>
                    <strong>{readingStats.sessions_this_month || 0}</strong>
                  </div>
                  <div className="books-insight-pill page-shell">
                    <span>Média por leitura</span>
                    <strong>{readingStats.avg_pages_per_session_month || 0} págs</strong>
                  </div>
                  <div className="books-insight-pill page-shell">
                    <span>Média geral</span>
                    <strong>{readingStats.avg_pages_per_session || 0} págs</strong>
                  </div>
                </section>

                <section className="books-insights-panel page-shell">
                  <div className="books-section-head">
                    <div>
                      <span className="books-kicker">Mês</span>
                      <h2>Por tipo</h2>
                    </div>
                    <small>{statsByType.month}/{statsByType.year}</small>
                  </div>
                  <div className="books-stats-list">
                    {(statsByType.monthly || []).length ? (
                      statsByType.monthly.map((row) => (
                        <div key={row.book_type} className="books-stat-row">
                          <div className="books-stat-copy">
                            <span>{row.book_type}</span>
                            {dailyAverageByType[row.book_type] ? (
                              <small>{dailyAverageByType[row.book_type].avg_pages_per_day} págs/dia</small>
                            ) : null}
                          </div>
                          <div className="books-stat-bar">
                            <div style={{ width: `${((Number(row.total_pages) || 0) / monthlyMax) * 100}%` }} />
                          </div>
                          <strong>{row.total_pages} págs</strong>
                        </div>
                      ))
                    ) : (
                      <p className="books-empty-inline">Sem páginas registradas neste mês.</p>
                    )}
                  </div>
                  {yearlyHighlights.length ? (
                    <div className="books-yearly-highlight">
                      <span className="books-kicker">Ano</span>
                      <div className="books-yearly-chip-row">
                        {yearlyHighlights.map((row) => (
                          <div key={`year-${row.book_type}`} className="books-yearly-chip">
                            <span>{row.book_type}</span>
                            <strong>{row.total_pages} págs</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="books-insights-panel page-shell">
                  <div className="books-section-head">
                    <div>
                      <span className="books-kicker">Recente</span>
                      <h2>Movimento</h2>
                    </div>
                    <small>{logData.length}</small>
                  </div>
                  <div className="books-log-list glass-scrollbar">
                    {logData.length ? (
                      logData.map((row) => (
                        <div key={row.id} className="books-log-row">
                          <div className="books-log-dot" />
                          <div className="books-log-copy">
                            <div className="books-log-topline">
                              <strong>{row.title}</strong>
                              <span>{formatDateTime(row.read_at)}</span>
                            </div>
                            <p>{row.book_type} · +{row.pages_read} págs · {row.start_page} → {row.end_page}</p>
                            <div className="books-log-tags">
                              {row.book_started_at ? <span>Início {formatDate(row.book_started_at)}</span> : null}
                              {row.book_finished_at ? <span>Fim {formatDate(row.book_finished_at)}</span> : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="books-empty-inline">Nenhuma sessão registrada ainda.</p>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Books;
