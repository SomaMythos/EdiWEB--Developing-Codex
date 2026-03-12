import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BookOpenText,
  Clock3,
  FolderPlus,
  Save,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { journalApi, notesApi } from '../services/api';
import './Anotacoes.css';

const TITLE_COLORS = ['#facc15', '#60a5fa', '#34d399', '#f472b6', '#f87171', '#c084fc'];
const CONTEXT_COLORS = ['#facc15', '#fb7185', '#34d399', '#60a5fa', '#c084fc', '#f97316'];
const EMPTY_NOTE = {
  title: '',
  content: '',
  context_id: null,
  title_color: TITLE_COLORS[0],
};

const emptySearchResults = { notes: [], journal_entries: [] };
const emptyCurrentJournal = {
  week: { label: '', week_start: '', week_end: '' },
  entry: null,
  pending: true,
};

const Anotacoes = () => {
  const location = useLocation();
  const activeTab = location.pathname === '/anotacoes/diario' ? 'journal' : 'notes';

  const [contexts, setContexts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(emptySearchResults);
  const [newContext, setNewContext] = useState({ name: '', color: CONTEXT_COLORS[0] });
  const [newNote, setNewNote] = useState(EMPTY_NOTE);
  const [journalSettings, setJournalSettings] = useState({ enabled: true, reminder_time: '18:00' });
  const [currentJournal, setCurrentJournal] = useState(emptyCurrentJournal);
  const [journalForm, setJournalForm] = useState({ title: '', content: '' });
  const [journalHistory, setJournalHistory] = useState([]);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab !== 'notes') return;
    if (!searchTerm.trim()) {
      setSearchResults(emptySearchResults);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await notesApi.search(searchTerm.trim());
        setSearchResults(response.data.data || emptySearchResults);
      } catch (error) {
        console.error('Erro ao buscar anotações:', error);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadContexts(), loadNotes(), loadJournal()]);
    } catch (error) {
      console.error('Erro ao carregar anotações:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o módulo de anotações.' });
    } finally {
      setLoading(false);
    }
  };

  const loadContexts = async () => {
    const response = await notesApi.listContexts();
    setContexts(response.data.data || []);
  };

  const loadNotes = async (contextValue = selectedContextId) => {
    const params = {};
    if (contextValue !== 'all' && contextValue !== 'none') {
      params.context_id = contextValue;
    }

    const response = await notesApi.list(params);
    let rows = response.data.data || [];
    if (contextValue === 'none') {
      rows = rows.filter((note) => !note.context_id);
    }
    setNotes(rows);
  };

  const loadJournal = async () => {
    const [settingsResponse, currentResponse, historyResponse] = await Promise.all([
      journalApi.getSettings(),
      journalApi.getCurrent(),
      journalApi.listEntries(),
    ]);

    const settingsData = settingsResponse.data.data || { enabled: true, reminder_time: '18:00' };
    const currentData = currentResponse.data.data || emptyCurrentJournal;

    setJournalSettings(settingsData);
    setCurrentJournal(currentData);
    setJournalHistory(historyResponse.data.data || []);
    setJournalForm({
      title: currentData.entry?.title || '',
      content: currentData.entry?.content || '',
    });
  };

  const handleCreateContext = async (event) => {
    event.preventDefault();
    if (!newContext.name.trim()) return;

    try {
      await notesApi.createContext(newContext);
      setNewContext({ name: '', color: CONTEXT_COLORS[0] });
      await loadContexts();
      setFeedback({ type: 'success', message: 'Contexto criado com sucesso.' });
    } catch (error) {
      console.error('Erro ao criar contexto:', error);
      setFeedback({ type: 'error', message: 'Erro ao criar contexto.' });
    }
  };

  const handleUpdateContext = async (context) => {
    try {
      await notesApi.updateContext(context.id, context);
      await loadContexts();
      setFeedback({ type: 'success', message: 'Contexto atualizado.' });
    } catch (error) {
      console.error('Erro ao atualizar contexto:', error);
      setFeedback({ type: 'error', message: 'Erro ao atualizar contexto.' });
    }
  };

  const handleDeleteContext = async (contextId) => {
    try {
      await notesApi.deleteContext(contextId);
      if (String(selectedContextId) === String(contextId)) {
        setSelectedContextId('all');
      }
      await Promise.all([loadContexts(), loadNotes('all')]);
      setFeedback({ type: 'success', message: 'Contexto removido.' });
    } catch (error) {
      console.error('Erro ao excluir contexto:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir contexto.' });
    }
  };

  const handleCreateNote = async (event) => {
    event.preventDefault();
    if (!newNote.title.trim()) return;

    try {
      const payload = {
        ...newNote,
        context_id:
          newNote.context_id ||
          (selectedContextId !== 'all' && selectedContextId !== 'none'
            ? Number(selectedContextId)
            : null),
      };
      await notesApi.create(payload);
      setNewNote({
        ...EMPTY_NOTE,
        context_id: payload.context_id,
      });
      await loadNotes();
      setFeedback({ type: 'success', message: 'Anotação criada com sucesso.' });
    } catch (error) {
      console.error('Erro ao criar anotação:', error);
      setFeedback({ type: 'error', message: 'Erro ao criar anotação.' });
    }
  };

  const handleSaveNote = async (note) => {
    try {
      await notesApi.update(note.id, note);
      await loadNotes();
      setFeedback({ type: 'success', message: 'Anotação salva.' });
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar anotação.' });
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await notesApi.delete(noteId);
      await loadNotes();
      setFeedback({ type: 'success', message: 'Anotação excluída.' });
    } catch (error) {
      console.error('Erro ao excluir anotação:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir anotação.' });
    }
  };

  const handleSaveJournal = async (event) => {
    event.preventDefault();
    if (!journalForm.content.trim()) {
      setFeedback({ type: 'error', message: 'Escreva como foi a semana antes de salvar o diário.' });
      return;
    }

    try {
      await journalApi.saveEntry(journalForm);
      await loadJournal();
      setFeedback({ type: 'success', message: 'Diário semanal salvo.' });
    } catch (error) {
      console.error('Erro ao salvar diário:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar diário semanal.' });
    }
  };

  const handleSaveJournalSettings = async () => {
    try {
      const response = await journalApi.updateSettings(journalSettings);
      setJournalSettings(response.data.data || journalSettings);
      setFeedback({ type: 'success', message: 'Configuração do diário atualizada.' });
    } catch (error) {
      console.error('Erro ao salvar configuração do diário:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar a configuração do diário.' });
    }
  };

  const notesToRender = useMemo(() => {
    if (!searchTerm.trim()) {
      return notes;
    }

    const token = searchTerm.trim().toLowerCase();
    return notes.filter((note) =>
      [note.title, note.content, note.context_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(token))
    );
  }, [notes, searchTerm]);

  if (loading) {
    return (
      <section className="notes-page">
        <div className="card notes-loading">Carregando...</div>
      </section>
    );
  }

  return (
    <section className="notes-page">
      <header className="notes-header">
        <div>
          <span className="notes-header-kicker">{activeTab === 'journal' ? 'Diário' : 'Anotações'}</span>
          <h1>{activeTab === 'journal' ? 'Diário semanal' : 'Anotações'}</h1>
          <p>
            {activeTab === 'journal'
              ? 'Um registro mais calmo e legível da semana atual.'
              : 'Contextos personalizados, busca e notas organizadas em um só lugar.'}
          </p>
        </div>
      </header>

      {feedback.message ? <div className={`notes-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      {activeTab === 'notes' ? (
        <div className="notes-shell">
          <aside className="notes-sidebar card">
            <div className="notes-sidebar-block">
              <h2>Contextos</h2>
              <button
                type="button"
                className={`context-chip ${selectedContextId === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedContextId('all');
                  loadNotes('all');
                }}
              >
                Todos
              </button>
              <button
                type="button"
                className={`context-chip ${selectedContextId === 'none' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedContextId('none');
                  loadNotes('none');
                }}
              >
                Sem contexto
              </button>
              {contexts.map((context) => (
                <div key={context.id} className="context-row">
                  <button
                    type="button"
                    className={`context-chip ${String(selectedContextId) === String(context.id) ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedContextId(context.id);
                      loadNotes(context.id);
                    }}
                    style={{ borderColor: context.color, color: context.color }}
                  >
                    {context.name}
                  </button>
                  <button type="button" className="icon-action" onClick={() => handleDeleteContext(context.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <form className="notes-sidebar-block" onSubmit={handleCreateContext}>
              <h2>Novo contexto</h2>
              <input
                type="text"
                value={newContext.name}
                onChange={(event) => setNewContext({ ...newContext, name: event.target.value })}
                placeholder="Ex: Trabalho profundo"
              />
              <div className="color-row">
                {CONTEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-dot ${newContext.color === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewContext({ ...newContext, color })}
                  />
                ))}
              </div>
              <button className="btn btn-primary" type="submit">
                <FolderPlus size={16} /> Criar contexto
              </button>
            </form>

            {contexts.length > 0 ? (
              <div className="notes-sidebar-block">
                <h2>Renomear</h2>
                {contexts.map((context) => (
                  <div key={`${context.id}-edit`} className="context-edit-card">
                    <input
                      type="text"
                      value={context.name}
                      onChange={(event) => {
                        setContexts((prev) =>
                          prev.map((item) =>
                            item.id === context.id ? { ...item, name: event.target.value } : item
                          )
                        );
                      }}
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => handleUpdateContext(context)}>
                      Salvar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>

          <div className="notes-main">
            <div className="notes-toolbar card">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar em notas e diários..."
                />
              </div>
            </div>

            <form className="card note-create-card" onSubmit={handleCreateNote}>
              <h2>Nova anotação</h2>
              <input
                type="text"
                value={newNote.title}
                onChange={(event) => setNewNote({ ...newNote, title: event.target.value })}
                placeholder="Título"
              />
              <textarea
                rows={4}
                value={newNote.content}
                onChange={(event) => setNewNote({ ...newNote, content: event.target.value })}
                placeholder="Escreva a anotação..."
              />
              <div className="note-create-meta">
                <select
                  value={newNote.context_id ?? ''}
                  onChange={(event) =>
                    setNewNote({
                      ...newNote,
                      context_id: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                >
                  <option value="">Sem contexto</option>
                  {contexts.map((context) => (
                    <option key={context.id} value={context.id}>
                      {context.name}
                    </option>
                  ))}
                </select>
                <div className="color-row">
                  {TITLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-dot ${newNote.title_color === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewNote({ ...newNote, title_color: color })}
                    />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                <StickyNote size={16} /> Criar anotação
              </button>
            </form>

            {searchTerm.trim() && (searchResults.journal_entries || []).length > 0 ? (
              <div className="card search-results-card">
                <h2>Resultados no diário</h2>
                {(searchResults.journal_entries || []).map((entry) => (
                  <div key={entry.id} className="search-result-row">
                    <div>
                      <strong>{entry.title || `Semana ${entry.week_start}`}</strong>
                      <p>{entry.content?.slice(0, 140) || 'Sem conteúdo.'}</p>
                    </div>
                    <span>{entry.week_start}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="notes-grid">
              {notesToRender.length === 0 ? (
                <div className="card notes-empty-state">
                  <BookOpenText size={24} />
                  <p>Nenhuma anotação encontrada para o filtro atual.</p>
                </div>
              ) : (
                notesToRender.map((note) => (
                  <article key={note.id} className="card note-card">
                    <div className="note-card-head">
                      <input
                        type="text"
                        value={note.title}
                        style={{ color: note.title_color || TITLE_COLORS[0] }}
                        onChange={(event) => {
                          setNotes((prev) =>
                            prev.map((item) =>
                              item.id === note.id ? { ...item, title: event.target.value } : item
                            )
                          );
                        }}
                      />
                      <button
                        type="button"
                        className="icon-action danger"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="note-card-meta">
                      <select
                        value={note.context_id ?? ''}
                        onChange={(event) => {
                          const value = event.target.value ? Number(event.target.value) : null;
                          setNotes((prev) =>
                            prev.map((item) =>
                              item.id === note.id ? { ...item, context_id: value } : item
                            )
                          );
                        }}
                      >
                        <option value="">Sem contexto</option>
                        {contexts.map((context) => (
                          <option key={context.id} value={context.id}>
                            {context.name}
                          </option>
                        ))}
                      </select>
                      <span>{new Date(note.updated_at || note.created_at).toLocaleString('pt-BR')}</span>
                    </div>

                    <textarea
                      rows={6}
                      value={note.content || ''}
                      onChange={(event) => {
                        setNotes((prev) =>
                          prev.map((item) =>
                            item.id === note.id ? { ...item, content: event.target.value } : item
                          )
                        );
                      }}
                    />

                    <div className="note-card-footer">
                      <div className="color-row">
                        {TITLE_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`color-dot ${note.title_color === color ? 'active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              setNotes((prev) =>
                                prev.map((item) =>
                                  item.id === note.id ? { ...item, title_color: color } : item
                                )
                              );
                            }}
                          />
                        ))}
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => handleSaveNote(note)}>
                        <Save size={16} /> Salvar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="journal-shell">
          <aside className="journal-side">
            <div className="card journal-settings-card">
              <span className="journal-card-kicker">Lembrete</span>
              <h2>Configuração</h2>
              <label className="toggle-row">
                <span className="journal-setting-label">Notificar semanalmente</span>
                <input
                  type="checkbox"
                  checked={!!journalSettings.enabled}
                  onChange={(event) =>
                    setJournalSettings({ ...journalSettings, enabled: event.target.checked })
                  }
                />
              </label>
              <label className="journal-setting-group">
                <span className="journal-setting-label">Horário de domingo</span>
                <div className="time-row">
                  <Clock3 size={16} />
                  <input
                    type="time"
                    value={journalSettings.reminder_time}
                    onChange={(event) =>
                      setJournalSettings({ ...journalSettings, reminder_time: event.target.value })
                    }
                  />
                </div>
              </label>
              <button type="button" className="btn btn-secondary" onClick={handleSaveJournalSettings}>
                <Save size={16} /> Salvar horário
              </button>
            </div>

            <div className="card journal-history-card">
              <span className="journal-card-kicker">Arquivo</span>
              <h2>Semanas anteriores</h2>
              <p className="journal-card-copy">Registros salvos para referência rápida.</p>
              {journalHistory.length === 0 ? (
                <p>Nenhum diário salvo ainda.</p>
              ) : (
                journalHistory.map((entry) => (
                  <div key={entry.id} className="journal-history-row">
                    <div>
                      <strong>{entry.title}</strong>
                      <p>
                        {entry.week_start} até {entry.week_end}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <form className="card journal-editor" onSubmit={handleSaveJournal}>
            <div className="journal-editor-head">
              <div>
                <span className="journal-editor-kicker">Semana em foco</span>
                <h2>{currentJournal.week.label || 'Semana atual'}</h2>
                <p>
                  {currentJournal.week.week_start || '--'} até {currentJournal.week.week_end || '--'}
                </p>
              </div>
              {currentJournal.pending ? <span className="journal-pending-badge">Pendente</span> : null}
            </div>

            <input
              type="text"
              value={journalForm.title}
              onChange={(event) => setJournalForm({ ...journalForm, title: event.target.value })}
              placeholder={`Ex: Semana ${currentJournal.week.label}`}
            />

            <textarea
              rows={16}
              value={journalForm.content}
              onChange={(event) => setJournalForm({ ...journalForm, content: event.target.value })}
              placeholder="Como foi a semana? O que avançou, o que travou, o que ficou marcado?"
            />

            <div className="journal-editor-footer">
              <span>Escreva com calma. Você pode revisar e atualizar depois.</span>
              <button className="btn btn-primary" type="submit">
                <Save size={16} /> Salvar diário
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default Anotacoes;

