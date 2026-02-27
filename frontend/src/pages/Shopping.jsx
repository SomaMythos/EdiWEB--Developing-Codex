import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, Calculator, Plus } from 'lucide-react';
import { shoppingApi } from '../services/api';
import './Shopping.css';

const initialFormData = {
  name: '',
  price: '',
  link: '',
  photo_url: '',
  item_type: 'necessidade',
};

const itemTypeLabels = {
  necessidade: 'Necessidades',
  desejo: 'Desejos',
};

const Shopping = () => {
  const [wishlist, setWishlist] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingId, setEditingId] = useState(null);
  const [sortBy, setSortBy] = useState('alphabetical');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingItemIds, setTogglingItemIds] = useState([]);
  const cancelDeleteRef = useRef(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await shoppingApi.listWishlist();
      setWishlist(res.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar wishlist', err);
      setFeedback({ type: 'error', message: 'Não foi possível carregar os itens agora.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupedItems = useMemo(() => {
    const normalized = wishlist.map((item) => ({
      ...item,
      item_type: item.item_type === 'necessidade' ? 'necessidade' : 'desejo',
    }));

    const sortFn = (a, b) => {
      if (sortBy === 'price') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }
      return (a.name || '').localeCompare((b.name || ''), 'pt-BR');
    };

    return {
      necessidade: normalized.filter((item) => item.item_type === 'necessidade').sort(sortFn),
      desejo: normalized.filter((item) => item.item_type === 'desejo').sort(sortFn),
    };
  }, [wishlist, sortBy]);

  const totalMarked = useMemo(
    () => wishlist.filter((item) => item.is_marked).reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [wishlist],
  );

  const totalAll = useMemo(
    () => wishlist.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [wishlist],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    const payload = {
      name: formData.name,
      price: formData.price ? Number(formData.price) : null,
      link: formData.link || null,
      photo_url: formData.photo_url || null,
      item_type: formData.item_type,
    };

    try {
      if (editingId) {
        await shoppingApi.updateWishlist(editingId, payload);
      } else {
        await shoppingApi.addWishlist(payload);
      }

      setFormData(initialFormData);
      setEditingId(null);
      setIsFormModalOpen(false);
      setFeedback({ type: 'success', message: editingId ? 'Item atualizado com sucesso.' : 'Item criado com sucesso.' });
      await load();
    } catch (err) {
      console.error('Erro ao salvar item', err);
      setFeedback({ type: 'error', message: 'Não foi possível salvar o item.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      price: item.price || '',
      link: item.link || '',
      photo_url: item.photo_url || '',
      item_type: item.item_type === 'necessidade' ? 'necessidade' : 'desejo',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setIsFormModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormModalOpen(false);
    setEditingId(null);
    setFormData(initialFormData);
  };

  useEffect(() => {
    if (pendingDeleteItemId && cancelDeleteRef.current) {
      cancelDeleteRef.current.focus();
    }
  }, [pendingDeleteItemId]);

  const handleDelete = async (itemId) => {
    setIsDeleting(true);
    setFeedback({ type: '', message: '' });
    try {
      await shoppingApi.deleteWishlist(itemId);
      setFeedback({ type: 'success', message: 'Item excluído com sucesso.' });
      await load();
    } catch (err) {
      console.error('Erro ao excluir item', err);
      setFeedback({ type: 'error', message: 'Não foi possível excluir o item.' });
    } finally {
      setIsDeleting(false);
      setPendingDeleteItemId(null);
    }
  };

  const handleToggleMarked = async (item) => {
    const nextMarked = !item.is_marked;
    setTogglingItemIds((prev) => [...prev, item.id]);
    setFeedback({ type: '', message: '' });

    setWishlist((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_marked: nextMarked } : entry)));

    try {
      await shoppingApi.markWishlist(item.id, nextMarked);
    } catch (err) {
      console.error('Erro ao atualizar marcação', err);
      setWishlist((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_marked: item.is_marked } : entry)));
      setFeedback({ type: 'error', message: 'Falha ao marcar item. Estado restaurado.' });
    } finally {
      setTogglingItemIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  return (
    <div className="shopping-page page-container fade-in">
      <header className="page-header">
        <div>
          <h1>Wishlist</h1>
          <p className="subtitle">Lista de desejos e necessidades pontuais (separada do módulo de consumíveis)</p>
        </div>
      </header>

      <section className="card shopping-toolbar">
        <button type="button" className="btn btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={16} />
          Novo cadastro
        </button>
        <label className="label">Organizar por</label>
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="alphabetical">Ordem alfabética</option>
          <option value="price">Preços</option>
        </select>
        <div className="shopping-total-box">
          <span>Total geral</span>
          <strong>R$ {totalAll.toFixed(2)}</strong>
        </div>
      </section>

      {feedback.message ? <div className={`upload-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      {isLoading ? <p className="muted">Carregando itens...</p> : null}

      <div className="shopping-sections">
        {Object.keys(itemTypeLabels).map((key) => (
          <section className="card shopping-list-card" key={key}>
            <h3>{itemTypeLabels[key]}</h3>
            {(groupedItems[key] || []).length === 0 ? (
              <p className="muted">Nenhum item nesta categoria.</p>
            ) : (
              <div className="shopping-list">
                {groupedItems[key].map((item) => (
                  <article key={item.id} className={`shopping-item ${item.is_marked ? 'marked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_marked)}
                      disabled={togglingItemIds.includes(item.id)}
                      onChange={() => handleToggleMarked(item)}
                      title="Marcar para orçamento"
                    />
                    {item.photo_url ? <img src={item.photo_url} alt={item.name} className="shopping-thumb" /> : <div className="shopping-thumb placeholder">sem foto</div>}
                    <div className="shopping-item-content">
                      <h4>{item.name}</h4>
                      <p>R$ {(Number(item.price) || 0).toFixed(2)}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer">
                          Abrir link
                        </a>
                      )}
                    </div>
                    <div className="shopping-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(item)}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setPendingDeleteItemId(item.id)} disabled={isDeleting}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <footer className="shopping-footer card">
        <button type="button" className="btn btn-primary">
          <Calculator size={16} />
          Orçamento: R$ {totalMarked.toFixed(2)}
        </button>
      </footer>

      {isFormModalOpen && (
        <div className="shopping-modal-overlay" onClick={handleCloseModal}>
          <section className="card shopping-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Editar cadastro' : 'Novo cadastro'}</h2>
            <form onSubmit={handleSubmit} className="shopping-form">
              <input
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do item"
                required
              />
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="Preço"
                required
              />
              <input
                className="input"
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="Link de compra"
              />
              <input
                className="input"
                type="url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                placeholder="Foto (URL opcional)"
              />
              <select
                className="input"
                value={formData.item_type}
                onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
              >
                <option value="necessidade">Necessidade</option>
                <option value="desejo">Desejo</option>
              </select>

              <div className="shopping-form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  <Plus size={16} />
                  {isSubmitting ? 'Salvando...' : (editingId ? 'Salvar alterações' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingDeleteItemId && (
        <div className="shopping-modal-overlay" onClick={() => !isDeleting && setPendingDeleteItemId(null)}>
          <section className="card shopping-modal-card" role="dialog" aria-modal="true" aria-labelledby="shopping-delete-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="shopping-delete-title">Excluir item</h2>
            <p>Tem certeza que deseja excluir este cadastro?</p>
            <div className="shopping-form-actions">
              <button ref={cancelDeleteRef} type="button" className="btn btn-secondary" onClick={() => setPendingDeleteItemId(null)} disabled={isDeleting}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(pendingDeleteItemId)} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Shopping;
