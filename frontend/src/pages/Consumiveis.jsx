import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [itemDetailsById, setItemDetailsById] = useState({});
  const [openPanelItemId, setOpenPanelItemId] = useState(null);
  const [openStatsItemId, setOpenStatsItemId] = useState(null);

  const [categoryName, setCategoryName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');

  const [restockDate, setRestockDate] = useState(getToday());
  const [restockPrice, setRestockPrice] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('1');
  const [finishDate, setFinishDate] = useState(getToday());

  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingDetailId, setIsLoadingDetailId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [recentlyRestocked, setRecentlyRestocked] = useState({});
  const [recentlyFinished, setRecentlyFinished] = useState({});
  const actionTimersRef = useRef({});

  useEffect(() => () => {
    Object.values(actionTimersRef.current).forEach((timerId) => {
      clearTimeout(timerId);
    });
  }, []);

  const markItemTemporarily = (itemId, setter, keyPrefix) => {
    if (!itemId) return;
    const timerKey = `${keyPrefix}-${itemId}`;

    if (actionTimersRef.current[timerKey]) {
      clearTimeout(actionTimersRef.current[timerKey]);
    }

    setter((previous) => ({ ...previous, [itemId]: true }));

    actionTimersRef.current[timerKey] = setTimeout(() => {
      setter((previous) => ({ ...previous, [itemId]: false }));
      delete actionTimersRef.current[timerKey];
    }, 1800);
  };

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

  const loadItemDetail = async (itemId, forceReload = false) => {
    if (!itemId) {
      return null;
    }

    if (!forceReload && itemDetailsById[itemId]) {
      return itemDetailsById[itemId];
    }

    setIsLoadingDetailId(itemId);
    try {
      const response = await consumablesApi.getItemDetail(itemId);
      const detail = response.data.data || null;
      setItemDetailsById((previous) => ({ ...previous, [itemId]: detail }));
      return detail;
    } catch (error) {
      console.error('Erro ao carregar detalhe do item', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o detalhe do item.' });
      return null;
    } finally {
      setIsLoadingDetailId((current) => (current === itemId ? null : current));
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  const filteredItems = useMemo(() => {
    if (activeCategoryId === 'all') return items;
    return items.filter((item) => String(item.category_id) === String(activeCategoryId));
  }, [items, activeCategoryId]);

  const withSubmit = async (action, options = {}) => {
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const result = await action();
      await loadBaseData();
      const targetItemId = options.refreshItemId ?? result?.refreshItemId ?? openPanelItemId;
      if (targetItemId) {
        await loadItemDetail(targetItemId, true);
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
      setItemName('');
      setFeedback({ type: 'success', message: 'Item consumível criado com sucesso.' });
      return { refreshItemId: newItemId };
    });
  };

  const handleOpenPanel = async (itemId) => {
    await loadItemDetail(itemId);
    setOpenPanelItemId(itemId);
  };

  const handleToggleStats = async (itemId) => {
    if (openStatsItemId === itemId) {
      setOpenStatsItemId(null);
      return;
    }

    await loadItemDetail(itemId);
    setOpenStatsItemId(itemId);
  };

  const handleRestock = async (itemId) => {
    if (!itemId || !restockDate) return;

    await withSubmit(async () => {
      const normalizedPrice = restockPrice === '' ? null : Number(restockPrice);
      await consumablesApi.restock(itemId, {
        purchase_date: restockDate,
        price_paid: normalizedPrice,
        stock_quantity: Number(restockQuantity || 1),
      });
      setRestockPrice('');
      setRestockQuantity('1');
      markItemTemporarily(itemId, setRecentlyRestocked, 'restock');
      setFeedback({ type: 'success', message: 'Estoque registrado com sucesso.' });
    });
  };

  const handleFinishCycle = async (itemId) => {
    if (!itemId || !finishDate) return;

    await withSubmit(async () => {
      const response = await consumablesApi.finishCycle(itemId, { ended_at: finishDate });
      const cycleData = response.data.data || {};
      const remainingQuantity = Number(cycleData.remaining_quantity ?? 0);
      const message = cycleData.cycle_closed
        ? 'Última unidade concluída e ciclo encerrado.'
        : `1 unidade concluída. Restam ${remainingQuantity} em estoque.`;

      markItemTemporarily(itemId, setRecentlyFinished, 'finish');
      setFeedback({ type: 'success', message });
    });
  };

  const groupedItems = useMemo(() => {
    const grouped = filteredItems.reduce((accumulator, item) => {
      const key = item.category_id;
      if (!accumulator[key]) {
        accumulator[key] = {
          categoryId: item.category_id,
          categoryName: item.category_name || 'Sem categoria',
          items: [],
        };
      }
      accumulator[key].items.push(item);
      return accumulator;
    }, {});

    return Object.values(grouped).sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'pt-BR'));
  }, [filteredItems]);

  const panelDetail = openPanelItemId ? itemDetailsById[openPanelItemId] : null;
  const stats = panelDetail?.stats || {};
  const cycles = panelDetail?.cycles || [];
  const openCycle = panelDetail?.open_cycle || null;
  const hasOpenCycle = Boolean(openCycle && Number(openCycle.remaining_quantity || 0) > 0);
  const currentStockQuantity = Number(openCycle?.remaining_quantity || 0);
  const isPanelRecentlyRestocked = Boolean(openPanelItemId && recentlyRestocked[openPanelItemId]);
  const isPanelRecentlyFinished = Boolean(openPanelItemId && recentlyFinished[openPanelItemId]);

  return (
    <div className="page-container fade-in consumiveis-page">
      <header className="page-header">
        <div>
          <h1>Consumíveis</h1>
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
          <div className="items-by-category">
            {groupedItems.map((group) => (
              <section key={group.categoryId} className="category-group">
                <h4>{group.categoryName}</h4>
                <div className="items-list">
                  {group.items.map((item) => {
                    const detail = itemDetailsById[item.id] || {};
                    const itemStats = detail.stats || {};
                    const isTooltipOpen = openStatsItemId === item.id;
                    const isRecentlyRestocked = Boolean(recentlyRestocked[item.id]);
                    const isRecentlyFinished = Boolean(recentlyFinished[item.id]);
                    const stockText = item.has_open_cycle
                      ? `${formatNumber(item.remaining_quantity)} em estoque`
                      : 'Sem estoque aberto';

                    return (
                      <div
                        key={item.id}
                        className={`item-row ${isRecentlyRestocked ? 'item-row--recent-restock' : ''} ${isRecentlyFinished ? 'item-row--recent-finish' : ''}`.trim()}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.category_name}</span>
                        <div className="item-stock-badge">{stockText}</div>

                        <div className="item-actions">
                          <button type="button" className="btn btn-secondary" onClick={() => handleOpenPanel(item.id)}>
                            Painel do item
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => handleToggleStats(item.id)}>
                            Estatísticas e previsões
                          </button>
                        </div>

                        {isTooltipOpen ? (
                          <div className="stats-tooltip" role="dialog" aria-label={`Estatísticas de ${item.name}`}>
                            {isLoadingDetailId === item.id ? <p className="muted">Carregando...</p> : null}
                            {isLoadingDetailId !== item.id ? (
                              <>
                                <div><span>Total de compras</span><strong>{itemStats.total_purchases ?? 0}</strong></div>
                                <div><span>Unidades concluídas</span><strong>{itemStats.total_units_consumed ?? 0}</strong></div>
                                <div><span>Em estoque</span><strong>{itemStats.current_stock_quantity ?? 0}</strong></div>
                                <div><span>Preço médio por unidade</span><strong>{formatCurrency(itemStats.avg_unit_price)}</strong></div>
                                <div><span>Duração média por unidade</span><strong>{formatNumber(itemStats.avg_duration_days)}</strong></div>
                                <div><span>Término previsto</span><strong>{formatDate(itemStats.predicted_end_date)}</strong></div>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {!isLoadingBase && filteredItems.length === 0 ? <p className="muted">Nenhum item para o filtro atual.</p> : null}
        </article>

        {openPanelItemId ? (
          <div className="consumiveis-modal-backdrop" onClick={() => setOpenPanelItemId(null)}>
            <article className="card consumiveis-modal-card span-2" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Painel do item</h3>
                <button type="button" className="btn btn-secondary" onClick={() => setOpenPanelItemId(null)}>Fechar</button>
              </div>
              {isLoadingDetailId === openPanelItemId ? <p className="muted">Carregando detalhe...</p> : null}

              {isLoadingDetailId !== openPanelItemId && panelDetail ? (
                <>
                  <p className="panel-title">
                    <strong>{panelDetail.item.name}</strong> · {panelDetail.item.category_name}
                  </p>
                  <p className="panel-stock-summary">
                    {hasOpenCycle ? `Estoque atual: ${formatNumber(currentStockQuantity)} unidade(s)` : 'Sem estoque aberto no momento'}
                  </p>

                  <div className="actions-grid">
                    <div className={`action-card ${isPanelRecentlyRestocked ? 'action-card--restocked' : ''}`.trim()}>
                      <h4>Restocar</h4>
                      <p className="muted">Informe a quantidade comprada para a previsão multiplicar a média por unidade.</p>
                      <input className="input" type="date" value={restockDate} onChange={(event) => setRestockDate(event.target.value)} />
                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Quantidade em estoque"
                        value={restockQuantity}
                        onChange={(event) => setRestockQuantity(event.target.value)}
                      />
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Preço pago (opcional)"
                        value={restockPrice}
                        onChange={(event) => setRestockPrice(event.target.value)}
                      />
                      <button type="button" className="btn btn-primary" onClick={() => handleRestock(openPanelItemId)} disabled={isSubmitting}>Restocar</button>
                    </div>

                    <div className={`action-card ${isPanelRecentlyFinished ? 'action-card--finished' : ''}`.trim()}>
                      <h4>Concluir 1 unidade</h4>
                      <p className="muted">
                        {hasOpenCycle ? `Restam ${formatNumber(currentStockQuantity)} unidade(s) em estoque.` : 'Sem estoque aberto para concluir.'}
                      </p>
                      <input className="input" type="date" value={finishDate} onChange={(event) => setFinishDate(event.target.value)} />
                      <button type="button" className="btn btn-secondary" onClick={() => handleFinishCycle(openPanelItemId)} disabled={isSubmitting || !hasOpenCycle}>Concluir unidade</button>
                      <span className={`finish-confirmation ${isPanelRecentlyFinished ? 'is-visible' : ''}`.trim()} aria-live="polite">
                        <span className="finish-confirmation__icon" aria-hidden="true">✓</span>
                        Concluído
                      </span>
                    </div>
                  </div>

                  <h4>Estatísticas e previsão</h4>
                  <div className="stats-grid">
                    <div><span>Total de compras</span><strong>{stats.total_purchases ?? 0}</strong></div>
                    <div><span>Unidades concluídas</span><strong>{stats.total_units_consumed ?? 0}</strong></div>
                    <div><span>Estoque atual</span><strong>{stats.current_stock_quantity ?? 0}</strong></div>
                    <div><span>Preço médio por unidade</span><strong>{formatCurrency(stats.avg_unit_price)}</strong></div>
                    <div><span>Preço médio por compra</span><strong>{formatCurrency(stats.avg_purchase_price)}</strong></div>
                    <div><span>Variação do último preço/unidade</span><strong>{formatCurrency(stats.last_price_delta)}</strong></div>
                    <div><span>Variação do último preço/unidade (%)</span><strong>{stats.last_price_delta_percent == null ? '—' : `${formatNumber(stats.last_price_delta_percent)}%`}</strong></div>
                    <div><span>Duração média por unidade</span><strong>{formatNumber(stats.avg_duration_days)} dias</strong></div>
                    <div><span>Frequência de compra / mês</span><strong>{formatNumber(stats.purchase_frequency_per_month)}</strong></div>
                    <div><span>Gasto médio mensal</span><strong>{formatCurrency(stats.monthly_avg_spend)}</strong></div>
                    <div><span>Gasto médio anual</span><strong>{formatCurrency(stats.annual_avg_spend)}</strong></div>
                    <div><span>Término previsto do estoque aberto</span><strong>{formatDate(stats.predicted_end_date)}</strong></div>
                  </div>

                  <h4>Histórico de ciclos</h4>
                  <div className="cycles-list">
                    {cycles.map((cycle) => (
                      <div key={cycle.id} className="cycle-row">
                        <span data-label="Compra">{formatDate(cycle.purchase_date)}</span>
                        <span data-label="Qtd inicial">{formatNumber(cycle.stock_quantity)}</span>
                        <span data-label="Em estoque">{formatNumber(cycle.remaining_quantity)}</span>
                        <span data-label="Preço">{formatCurrency(cycle.price_paid)}</span>
                        <span data-label="Fim">{formatDate(cycle.ended_at)}</span>
                      </div>
                    ))}
                    {cycles.length === 0 ? <p className="muted">Sem ciclos registrados.</p> : null}
                  </div>
                </>
              ) : null}
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default Consumiveis;
