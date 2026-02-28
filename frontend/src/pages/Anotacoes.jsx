import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  Save,
  Trash2,
  Palette,
  StickyNote,
} from 'lucide-react';
import './Anotacoes.css';

const STORAGE_KEY = 'edi.anotacoes.v1';

const TITLE_COLORS = ['#facc15', '#60a5fa', '#34d399', '#f472b6', '#f87171', '#c084fc'];

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Anotacoes = () => {
  const [newTitle, setNewTitle] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setNotes(parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar anotações:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const sortedNotes = useMemo(() => {
    const cloned = [...notes];
    if (sortBy === 'alphabetical') {
      return cloned.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return cloned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notes, sortBy]);

  const handleCreateNote = (e) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    setNotes((prev) => [
      {
        id: createId(),
        title: trimmed,
        titleColor: TITLE_COLORS[0],
        content: '',
        createdAt: now,
        updatedAt: now,
        isExpanded: true,
        isEditing: true,
      },
      ...prev,
    ]);
    setNewTitle('');
  };

  const updateNote = (id, updater) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updater(note), updatedAt: new Date().toISOString() } : note))
    );
  };

  const toggleExpand = (id) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, isExpanded: !note.isExpanded } : note)));
  };

  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const formatCreatedAt = (isoDate) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(isoDate));
    } catch {
      return isoDate;
    }
  };

  return (
    <section className="notes-page">
      <header className="notes-header">
        <h1>Anotações</h1>
        <p>Crie, organize e gerencie suas notas no estilo sticky notes.</p>
      </header>

      <form className="notes-create-form card" onSubmit={handleCreateNote}>
        <label htmlFor="note-title">Nome da nova anotação</label>
        <div className="notes-create-row">
          <input
            id="note-title"
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Ex: Ideias para projeto"
          />
          <button className="btn btn-primary" type="submit">
            Criar anotação
          </button>
        </div>
      </form>

      <div className="notes-toolbar card">
        <label htmlFor="note-sort">Ordenar por</label>
        <select id="note-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="date">Data de criação</option>
          <option value="alphabetical">Ordem alfabética</option>
        </select>
      </div>

      <div className="notes-grid">
        {sortedNotes.length === 0 ? (
          <div className="notes-empty card">
            <StickyNote size={26} />
            <p>Nenhuma anotação ainda. Crie a primeira para começar.</p>
          </div>
        ) : (
          sortedNotes.map((note) => (
            <article className="sticky-note card" key={note.id}>
              <div className="sticky-note-head">
                <button className="note-expand" type="button" onClick={() => toggleExpand(note.id)}>
                  {note.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <h2 style={{ color: note.titleColor }}>{note.title}</h2>

                <span className="note-created">{formatCreatedAt(note.createdAt)}</span>
              </div>

              {note.isExpanded && (
                <>
                  <div className="note-actions">
                    <div className="color-picker-wrap" aria-label="Escolher cor do título">
                      <Palette size={16} />
                      {TITLE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`color-dot ${note.titleColor === color ? 'active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => updateNote(note.id, () => ({ titleColor: color }))}
                          aria-label={`Aplicar cor ${color}`}
                        />
                      ))}
                    </div>

                    {note.isEditing ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => updateNote(note.id, () => ({ isEditing: false }))}
                      >
                        <Save size={16} /> Salvar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => updateNote(note.id, () => ({ isEditing: true }))}
                      >
                        <Edit3 size={16} /> Editar
                      </button>
                    )}

                    <button type="button" className="btn btn-danger" onClick={() => deleteNote(note.id)}>
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>

                  <textarea
                    value={note.content}
                    onChange={(event) => updateNote(note.id, () => ({ content: event.target.value }))}
                    disabled={!note.isEditing}
                    placeholder="Escreva sua anotação aqui..."
                    rows={7}
                  />
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
};

export default Anotacoes;
