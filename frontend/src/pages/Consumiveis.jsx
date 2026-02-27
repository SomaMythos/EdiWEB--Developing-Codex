import React, { useEffect, useMemo, useState } from 'react';
import { consumablesApi } from '../services/api';
import './Consumiveis.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR');

const formatCurrency = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return currencyFormatter.format(Number(value));
};

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return numberFormatter.format(Number(value));
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
};

const getToday = () => new Date().toISOString().slice(0, 10);

const Consumiveis = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);

  const [categoryName, setCategoryName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');

  const [restockDate, setRestockDate] = useState(getToday());
  const [restockPrice, setRestockPrice] = useState('');
  const [finishDate, setFinishDate] = useState(getToday());

  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadBaseData = async () => {
    setIsLoadingBase(true);
    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        consumablesApi.listCategories(),
        consumablesApi.listItems(),
      ]);

      const categoryData = categoriesResponse.data.data || [];
      const itemData = itemsResponse.data.data || [];

      setCategories(categoryData);
      setItems(itemData);

      if (!selectedItemId && itemData.length > 0) {
        setSelectedItemId(itemData[0].id);
      }

      if (!itemCategoryId && categoryData.length > 0) {
        setItemCategoryId(String(categoryData[0].id));
      }
    } catch (error) {
      console.error('Erro ao carregar consumíveis', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar os consumíveis.' });
    } finally {
      setIsLoadingBase(false);
    }
  };

  const loadItemDetail = async (itemId) => {
    if (!itemId) {
      setItemDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    try {
      const response = await consumablesApi.getItemDetail(itemId);
      setItemDetail(response.data.data || null);
    } catch (error) {
      console.error('Erro ao carregar detalhe do item', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o detalhe do item.' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadItemDetail(selectedItemId);
  }, [selectedItemId]);

  const filteredItems = useMemo(() => {
    if (activeCategoryId === 'all') return items;
    return items.filter((item) => String(item.category_id) === String(activeCategoryId));
  }, [items, activeCategoryId]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    const selectedStillVisible = filteredItems.some((item) => item.id === selectedItemId);
    if (!selectedStillVisible) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  const withSubmit = async (action, options = {}) => {
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const result = await action();
      await loadBaseData();
      const targetItemId = options.refreshItemId ?? result?.refreshItemId ?? selectedItemId;
      if (targetItemId) {
        await loadItemDetail(targetItemId);
      }
    } catch (error) {
      console.error('Erro na operação de consumíveis', error);
      const message = error?.response?.data?.detail || 'Não foi possível concluir a operação.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    if (!categoryName.trim()) return;

    await withSubmit(async () => {
      await consumablesApi.createCategory({ name: categoryName.trim() });
      setCategoryName('');
      setFeedback({ type: 'success', message: 'Categoria criada com sucesso.' });
    });
  };

  const handleCreateItem = async (event) => {
    event.preventDefault();
    if (!itemName.trim() || !itemCategoryId) return;

    await withSubmit(async () => {
      const response = await consumablesApi.createItem({
        name: itemName.trim(),
        category_id: Number(itemCategoryId),
      });
      const newItemId = response.data.data?.id;
      if (newItemId) {
        setSelectedItemId(newItemId);
      }
      setItemName('');
      setFeedback({ type: 'success', message: 'Item consumível criado com sucesso.' });
      return { refreshItemId: newItemId };
    });
  };

  const handleRestock = async () => {
    if (!selectedItemId || !restockDate) return;

    await withSubmit(async () => {
      const normalizedPrice = restockPrice === '' ? null : Number(restockPrice);
      await consumablesApi.restock(selectedItemId, {
        purchase_date: restockDate,
        price_paid: normalizedPrice,
      });
      setRestockPrice('');
      setFeedback({ type: 'success', message: 'Restoque registrado com sucesso.' });
    });
  };

  const handleFinishCycle = async () => {
    if (!selectedItemId || !finishDate) return;

    await withSubmit(async () => {
      await consumablesApi.finishCycle(selectedItemId, { ended_at: finishDate });
      setFeedback({ type: 'success', message: 'Ciclo finalizado com sucesso.' });
    });
  };

  const stats = itemDetail?.stats || {};
  const cycles = itemDetail?.cycles || [];
  const hasOpenCycle = cycles.some((cycle) => cycle.ended_at == null);

  return (
    <div className="page-container fade-in consumiveis-page">
      <header className="page-header">
        <div>
          <h1>Consumíveis</h1>
          <p className="subtitle">Módulo separado para controle de estoque recorrente por ciclo.</p>
        </div>
      </header>

      {feedback.message ? <div className={`upload-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      <section className="consumiveis-grid">
        <article className="card">
          <h3>Categorias</h3>
          <form className="inline-form" onSubmit={handleCreateCategory}>
            <input
              className="input"
              placeholder="Nova categoria"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>Criar</button>
          </form>

          <div className="chips-wrap">
            <button
              type="button"
              className={`chip ${activeCategoryId === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategoryId('all')}
            >
              Todas
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`chip ${String(activeCategoryId) === String(category.id) ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(String(category.id))}
              >
                {category.name}
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Novo item consumível</h3>
          <form className="stack-form" onSubmit={handleCreateItem}>
            <input
              className="input"
              placeholder="Nome do item"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              required
            />
            <select
              className="input"
              value={itemCategoryId}
              onChange={(event) => setItemCategoryId(event.target.value)}
              required
            >
              {categories.length === 0 ? <option value="">Cadastre uma categoria antes</option> : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting || categories.length === 0}>Cadastrar item</button>
          </form>
        </article>

        <article className="card span-2">
          <h3>Itens consumíveis</h3>
          {isLoadingBase ? <p className="muted">Carregando itens...</p> : null}
          <div className="items-list">
            {filteredItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`item-row ${selectedItemId === item.id ? 'active' : ''}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.category_name}</span>
              </button>
            ))}
          </div>
          {!isLoadingBase && filteredItems.length === 0 ? <p className="muted">Nenhum item para o filtro atual.</p> : null}
        </article>

        <article className="card span-2">
          <h3>Painel do item</h3>
          {!selectedItemId ? <p className="muted">Selecione um item para visualizar detalhes.</p> : null}
          {isLoadingDetail ? <p className="muted">Carregando detalhe...</p> : null}

          {!isLoadingDetail && itemDetail ? (
            <>
              <p className="panel-title">
                <strong>{itemDetail.item.name}</strong> · {itemDetail.item.category_name}
              </p>

              <div className="actions-grid">
                <div className="action-card">
                  <h4>Restocar</h4>
                  <p className="muted">Preço é opcional para registrar compras sem valor.</p>
                  <input className="input" type="date" value={restockDate} onChange={(event) => setRestockDate(event.target.value)} />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Preço pago (opcional)"
                    value={restockPrice}
                    onChange={(event) => setRestockPrice(event.target.value)}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleRestock} disabled={isSubmitting}>Restocar</button>
                </div>

                <div className="action-card">
                  <h4>Marcar como finalizado</h4>
                  <input className="input" type="date" value={finishDate} onChange={(event) => setFinishDate(event.target.value)} />
                  {!hasOpenCycle ? <p className="muted">Sem ciclo aberto para finalizar.</p> : null}
                  <button type="button" className="btn btn-secondary" onClick={handleFinishCycle} disabled={isSubmitting || !hasOpenCycle}>Finalizar ciclo</button>
                </div>
              </div>

              <h4>Estatísticas e previsão</h4>
              <div className="stats-grid">
                <div><span>Total de compras</span><strong>{stats.total_purchases ?? 0}</strong></div>
                <div><span>Preço médio</span><strong>{formatCurrency(stats.avg_price)}</strong></div>
                <div><span>Variação do último preço</span><strong>{formatCurrency(stats.last_price_delta)}</strong></div>
                <div><span>Variação do último preço (%)</span><strong>{stats.last_price_delta_percent == null ? '—' : `${formatNumber(stats.last_price_delta_percent)}%`}</strong></div>
                <div><span>Duração média (dias)</span><strong>{formatNumber(stats.avg_duration_days)}</strong></div>
                <div><span>Frequência de compra / mês</span><strong>{formatNumber(stats.purchase_frequency_per_month)}</strong></div>
                <div><span>Gasto médio mensal</span><strong>{formatCurrency(stats.monthly_avg_spend)}</strong></div>
                <div><span>Gasto médio anual</span><strong>{formatCurrency(stats.annual_avg_spend)}</strong></div>
                <div><span>Término previsto do ciclo aberto</span><strong>{formatDate(stats.predicted_end_date)}</strong></div>
              </div>

              <h4>Histórico de ciclos</h4>
              <div className="cycles-list">
                {cycles.map((cycle) => (
                  <div key={cycle.id} className="cycle-row">
                    <span data-label="Compra">{formatDate(cycle.purchase_date)}</span>
                    <span data-label="Preço">{formatCurrency(cycle.price_paid)}</span>
                    <span data-label="Fim">{formatDate(cycle.ended_at)}</span>
                    <span data-label="Duração">{cycle.duration_days == null ? 'Em aberto' : `${formatNumber(cycle.duration_days)} dias`}</span>
                  </div>
                ))}
                {cycles.length === 0 ? <p className="muted">Sem ciclos registrados.</p> : null}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
};

export default Consumiveis;
