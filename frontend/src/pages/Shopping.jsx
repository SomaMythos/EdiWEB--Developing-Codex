import React, { useEffect, useMemo, useState } from 'react';
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

  const load = async () => {
    const res = await shoppingApi.listWishlist();
    setWishlist(res.data.data || []);
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

    const payload = {
      name: formData.name,
      price: formData.price ? Number(formData.price) : null,
      link: formData.link || null,
      photo_url: formData.photo_url || null,
      item_type: formData.item_type,
    };

    if (editingId) {
      await shoppingApi.updateWishlist(editingId, payload);
    } else {
      await shoppingApi.addWishlist(payload);
    }

    setFormData(initialFormData);
    setEditingId(null);
    setIsFormModalOpen(false);
    load();
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

  const handleDelete = async (itemId) => {
    if (!window.confirm('Deseja excluir este cadastro?')) return;
    await shoppingApi.deleteWishlist(itemId);
    load();
  };

  const handleToggleMarked = async (item) => {
    await shoppingApi.markWishlist(item.id, !item.is_marked);
    setWishlist((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_marked: !entry.is_marked } : entry)));
  };

  return (
    <div className="shopping-page page-container fade-in">
      <header className="page-header">
        <div>
          <h1>Shopping</h1>
          <p className="subtitle">Organize necessidades e desejos com orçamento rápido</p>
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
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
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
                <button className="btn btn-primary" type="submit">
                  <Plus size={16} />
                  {editingId ? 'Salvar alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default Shopping;
