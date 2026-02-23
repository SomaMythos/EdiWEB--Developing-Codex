import React, { useEffect, useMemo, useState } from 'react';
import { booksApi } from '../services/api';
import "./Books.css";

const Books = () => {
  const [books, setBooks] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ title: '', total_pages: 0, cover_image: '', book_type: 'Livro' });
  const [newType, setNewType] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeBook, setActiveBook] = useState(null);
  const [targetPage, setTargetPage] = useState(0);

const [showLog, setShowLog] = useState(false);
const [logData, setLogData] = useState([]);
const [statsData, setStatsData] = useState({ monthly: [], yearly: [], daily_average: [], month: null, year: null });

// Modal de criação de livro
const [createModalOpen, setCreateModalOpen] = useState(false);
const [removeMode, setRemoveMode] = useState(false);

  const groupedBooks = useMemo(() => {
    return books.reduce((acc, book) => {
      const key = book.book_type_name || book.book_type || 'Livro';
      if (!acc[key]) acc[key] = [];
      acc[key].push(book);
      return acc;
    }, {});
  }, [books]);

  const load = async () => {
    setLoading(true);
    try {
      const [booksRes, typesRes] = await Promise.all([booksApi.list(), booksApi.listTypes()]);
      setBooks(booksRes.data.data || []);
      setTypes(typesRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadLogAndStats = async () => {
    const [logRes, statsRes] = await Promise.all([booksApi.getLog(), booksApi.getStatsByType()]);
    setLogData(logRes.data.data || []);
    setStatsData(statsRes.data.data || { monthly: [], yearly: [], daily_average: [] });
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    await booksApi.create(form);
    setForm({ title: '', total_pages: 0, cover_image: '', book_type: 'Livro' });
    load();
  };

  const onCreateType = async () => {
    if (!newType.trim()) return;
    await booksApi.createType({ name: newType });
    setForm((prev) => ({ ...prev, book_type: newType.trim() }));
    setNewType('');
    load();
  };

  const openUpdate = (book) => {
    setActiveBook(book);
    setTargetPage(book.current_page || 0);
  };

  const confirmUpdate = async () => {
    if (!activeBook) return;
    const current = activeBook.current_page || 0;
    const pagesRead = Math.max(0, targetPage - current);
    await booksApi.addSession(activeBook.id, { pages_read: pagesRead, read_at: new Date().toISOString() });
    setActiveBook(null);
    await load();
  };

  const openLog = async () => {
    await loadLogAndStats();
    setShowLog(true);
  };

  return (
    <div className="page-container fade-in">
<div className="books-header">
  <h1>Leitura</h1>

  <div className="books-actions">
    <button
      className="btn btn-primary"
      onClick={openLog}
    >
      Log de leitura
    </button>

    <button
  className={`btn ${removeMode ? 'btn-danger-active' : 'btn-danger-soft'}`}
      onClick={() => setRemoveMode((prev) => !prev)}
    >
      {removeMode ? 'Cancelar remoção' : 'Remover livro'}
    </button>
  </div>
</div>

<div className="books-section">
  <button
    className="btn btn-primary"
    type="button"
    onClick={() => setCreateModalOpen(true)}
  >
    Novo livro
  </button>
</div>

      <div style={{ marginTop: 20 }}>
  {loading && <p>Carregando...</p>}

  {!loading && Object.entries(groupedBooks).map(([type, items]) => (
    <div key={type} style={{ marginBottom: 28 }}>
      <h2 style={{ marginBottom: 12 }}>{type}</h2>

      <div className="books-grid">
        {items.map((b) => {
          const total = b.total_pages || 0;
          const current = b.current_page || 0;
          const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
          const radius = 36;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (percent / 100) * circumference;

          return (
<div
  key={b.id}
  className={`book-card-wrapper ${removeMode ? 'remove-mode' : ''}`}
  onClick={async () => {
    if (!removeMode) return;

    const confirmed = window.confirm(`Remover "${b.title}"?`);
    if (!confirmed) return;

    await booksApi.delete(b.id);
    await load();
  }}
  onMouseEnter={(e) => {
    const emoji = e.currentTarget.querySelector('.refresh-emoji');
    if (emoji && !removeMode) emoji.style.opacity = 1;
  }}
  onMouseLeave={(e) => {
    const emoji = e.currentTarget.querySelector('.refresh-emoji');
    if (emoji) emoji.style.opacity = 0;
  }}
>
  <div
    className="book-card"
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.45)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 6px 6px rgba(0,0,0,0.35)';
    }}
  >
<img src={b.cover_image || 'https://via.placeholder.com/200x300?text=Sem+Foto'} alt={b.title} className="book-cover" />

    <div className="book-progress-overlay">
      <div className="book-progress-bar">
        <div
  className="book-progress-fill"
  style={{ width: `${percent}%` }}
/>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '-40%',
            width: '40%',
            height: '100%',
            background: 'linear-gradient(120deg, transparent, rgba(255,255,255,0.7), transparent)',
            animation: 'shine 2.5s infinite'
          }}
        />

        <div className="book-progress-text">
          {b.current_page || 0}/{b.total_pages || 0}
        </div>
      </div>
    </div>
  </div>

  <div
    className="book-refresh-btn"
    onClick={(e) => {
      e.stopPropagation();
      openUpdate(b);
    }}
    style={{
      position: 'absolute',
      bottom: -18,
      right: -18,
      width: 46,
      height: 46,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      backdropFilter: 'blur(6px)',
      background: 'rgba(0,0,0,0.55)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      transform: 'scale(1)'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'rotate(180deg) scale(1.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
    }}
  >
<svg
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2.2"
  strokeLinecap="round"
  strokeLinejoin="round"
  className="book-refresh-icon"
>
  <polyline points="23 4 23 10 17 10" />
  <polyline points="1 20 1 14 7 14" />
  <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15" />
</svg>
  </div>
</div>
);
        })}
      </div>
    </div>
  ))}
</div>

{createModalOpen && (
  <div className="book-modal-backdrop">
    <div className="book-modal-card">
      <h3>Novo livro</h3>

      <form
        onSubmit={async (e) => {
          await onSubmit(e);
          setCreateModalOpen(false);
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <input
          className="input"
          placeholder="Título"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <input
          className="input"
          type="number"
          placeholder="Nº páginas"
          value={form.total_pages}
          onChange={(e) => setForm({ ...form, total_pages: parseInt(e.target.value || 0, 10) })}
        />

        <input
          className="input"
          placeholder="Foto URL"
          value={form.cover_image}
          onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
        />

        <select
          className="input"
          value={form.book_type}
          onChange={(e) => setForm({ ...form, book_type: e.target.value })}
        >
          {types.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
          {!types.length && <option value="Livro">Livro</option>}
        </select>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Novo tipo"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            onClick={onCreateType}
          >
            Criar tipo
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setCreateModalOpen(false)}
          >
            Cancelar
          </button>

          <button className="btn btn-primary">
            Adicionar
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {activeBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: 20, width: 420, maxWidth: '95vw' }}>
            <h3>Atualizar: {activeBook.title}</h3>
            <p>Página atual: {targetPage}</p>
            <input
              type="range"
              min={0}
              max={activeBook.total_pages || 0}
              value={targetPage}
              onChange={(e) => setTargetPage(parseInt(e.target.value, 10))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={() => setActiveBook(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmUpdate}>OK</button>
            </div>
          </div>
        </div>
      )}

      {showLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: 20, width: 860, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Log de leitura</h2>
              <button className="btn" onClick={() => setShowLog(false)}>Fechar</button>
            </div>

            <h3>Histórico cronológico</h3>
            {logData.map((row) => (
              <div key={row.id} className="book-log-entry">
                <strong>{row.title}</strong> ({row.book_type}) — +{row.pages_read} págs ({row.start_page}→{row.end_page}) em {new Date(row.read_at).toLocaleString('pt-BR')}
              </div>
            ))}

            <h3 style={{ marginTop: 16 }}>Estatísticas por tipo ({statsData.month}/{statsData.year})</h3>
            {(statsData.monthly || []).map((row) => (
              <div key={`m-${row.book_type}`}>{row.book_type}: {row.total_pages} páginas no mês</div>
            ))}

            <h3 style={{ marginTop: 16 }}>Estatísticas anuais por tipo</h3>
            {(statsData.yearly || []).map((row) => (
              <div key={`y-${row.book_type}`}>{row.book_type}: {row.total_pages} páginas no ano</div>
            ))}

            <h3 style={{ marginTop: 16 }}>Média de páginas por tipo/dia</h3>
            {(statsData.daily_average || []).map((row) => (
              <div key={`d-${row.book_type}`}>{row.book_type}: {row.avg_pages_per_day} pág/dia ({row.active_days} dias ativos)</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;
