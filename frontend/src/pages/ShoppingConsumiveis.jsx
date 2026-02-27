import React, { useEffect, useMemo, useState } from 'react';
import { consumablesApi } from '../services/api';
import './ShoppingConsumiveis.css';

const fmtMoney = (value) => (value == null ? '—' : `R$ ${Number(value).toFixed(2)}`);
const fmtNumber = (value, digits = 2) => (value == null ? '—' : Number(value).toFixed(digits));

const ShoppingConsumiveis = () => {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const loadItems = async () => {
    setIsLoadingItems(true);
    try {
      const response = await consumablesApi.listItems();
      const data = response.data.data || [];
      setItems(data);
      if (!selectedItemId && data.length > 0) {
        setSelectedItemId(data[0].id);
      }
    } finally {
      setIsLoadingItems(false);
    }
  };

  const loadDetail = async (itemId) => {
    if (!itemId) return;
    setIsLoadingDetail(true);
    try {
      const response = await consumablesApi.getItemDetail(itemId);
      setItemDetail(response.data.data || null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    loadDetail(selectedItemId);
  }, [selectedItemId]);

  const stats = itemDetail?.stats || {};
  const cycles = useMemo(() => itemDetail?.cycles || [], [itemDetail]);

  return (
    <div className="page-container fade-in consumables-page">
      <header className="page-header">
        <div>
          <h1>Consumíveis</h1>
          <p className="subtitle">Detalhe completo do item com histórico e estimativas</p>
        </div>
      </header>

      <section className="consumables-layout">
        <article className="card">
          <h3>Itens</h3>
          {isLoadingItems ? <p className="muted">Carregando itens...</p> : null}
          <div className="consumables-items">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`consumables-item-btn ${selectedItemId === item.id ? 'active' : ''}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.category_name}</span>
              </button>
            ))}
            {!isLoadingItems && items.length === 0 ? <p className="muted">Nenhum item cadastrado.</p> : null}
          </div>
        </article>

        <article className="card">
          <h3>Detalhe do item</h3>
          {isLoadingDetail ? <p className="muted">Carregando detalhe...</p> : null}
          {!isLoadingDetail && itemDetail ? (
            <>
              <p><strong>{itemDetail.item.name}</strong> · {itemDetail.item.category_name}</p>
              <div className="consumables-stats-grid">
                <div><span>Total de compras</span><strong>{stats.total_purchases ?? 0}</strong></div>
                <div><span>Preço médio</span><strong>{fmtMoney(stats.avg_price)}</strong></div>
                <div><span>Variação do último preço</span><strong>{fmtMoney(stats.last_price_delta)}</strong></div>
                <div><span>Variação do último preço (%)</span><strong>{stats.last_price_delta_percent == null ? '—' : `${fmtNumber(stats.last_price_delta_percent)}%`}</strong></div>
                <div><span>Duração média (dias)</span><strong>{fmtNumber(stats.avg_duration_days)}</strong></div>
                <div><span>Frequência de compra (mês)</span><strong>{fmtNumber(stats.purchase_frequency_per_month)}</strong></div>
                <div><span>Gasto médio mensal</span><strong>{fmtMoney(stats.monthly_avg_spend)}</strong></div>
                <div><span>Gasto médio anual</span><strong>{fmtMoney(stats.annual_avg_spend)}</strong></div>
                <div><span>Término previsto do ciclo aberto</span><strong>{stats.predicted_end_date || '—'}</strong></div>
              </div>

              <h4>Ciclos</h4>
              <div className="consumables-cycles-list">
                {cycles.map((cycle) => (
                  <div key={cycle.id} className="consumables-cycle-row">
                    <span>{cycle.purchase_date}</span>
                    <span>{fmtMoney(cycle.price_paid)}</span>
                    <span>{cycle.ended_at || 'Aberto'}</span>
                    <span>{cycle.duration_days ?? '—'} dias</span>
                  </div>
                ))}
                {cycles.length === 0 ? <p className="muted">Sem histórico de ciclos.</p> : null}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
};

export default ShoppingConsumiveis;
