// src/pages/Financeiro.jsx
import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { financeApi } from '../services/api';
import './Financeiro.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from 'recharts';

const getCSSVar = (name, fallback = '#22c55e') => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

const Financeiro = () => {
  const [showConfig, setShowConfig] = useState(false);
  const [summary, setSummary] = useState(null);
  const [config, setConfig] = useState({});
  const [gastosFixos, setGastosFixos] = useState([]);
  const [projection, setProjection] = useState([]);
  
  const chartColors = {
  total: getCSSVar('--accent-success', '#22c55e'),
  current: getCSSVar('--accent-info', '#3b82f6'),
  cdb: getCSSVar('--accent-warning', '#f59e0b'),
  extra: getCSSVar('--accent-primary', '#8b5cf6'),
  fgts: getCSSVar('--error', '#ef4444')
};

  const [novoGasto, setNovoGasto] = useState({
    name: '',
    monthly_value: ''
  });

  const [editandoId, setEditandoId] = useState(null);
  const [editGasto, setEditGasto] = useState({
    name: '',
    monthly_value: ''
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      await Promise.all([
        loadSummary(),
        loadConfig(),
        loadGastos(),
        loadProjection()
      ]);
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    }
  };

  const loadSummary = async () => {
    const res = await financeApi.getSummary();
    setSummary(res.data.data || {});
  };

  const loadConfig = async () => {
    const res = await financeApi.getConfig();
    setConfig(res.data.data || {});
  };

  const loadGastos = async () => {
    const res = await financeApi.listFixedExpenses();
    setGastosFixos(res.data.data || []);
  };

  const loadProjection = async () => {
    const res = await financeApi.getProjection(120);
    setProjection(res.data.data || []);
  };

  const handleSaveConfig = async () => {
    try {
      await financeApi.saveConfig(config);
      setShowConfig(false);
      await loadAll();
    } catch (error) {
      console.error("Erro ao salvar config:", error);
    }
  };

  const handleAddGasto = async () => {
    if (!novoGasto.name || !novoGasto.monthly_value) return;

    try {
      await financeApi.createFixedExpense({
        name: novoGasto.name,
        monthly_value: Number(novoGasto.monthly_value)
      });

      setNovoGasto({ name: '', monthly_value: '' });
      await loadGastos();
      await loadSummary();
    } catch (error) {
      console.error("Erro ao adicionar gasto:", error);
    }
  };

  const handleDeleteGasto = async (id) => {
    try {
      await financeApi.deleteFixedExpense(id);
      await loadGastos();
      await loadSummary();
    } catch (error) {
      console.error("Erro ao remover gasto:", error);
    }
  };

  const handleStartEdit = (gasto) => {
    setEditandoId(gasto.id);
    setEditGasto({
      name: gasto.name,
      monthly_value: gasto.monthly_value
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      await financeApi.updateFixedExpense(id, {
        name: editGasto.name,
        monthly_value: Number(editGasto.monthly_value)
      });
      setEditandoId(null);
      await loadGastos();
      await loadSummary();
    } catch (error) {
      console.error("Erro ao editar gasto:", error);
    }
  };

  // total de gastos fixos
  const totalGastosFixos = (gastosFixos || []).reduce((acc, g) => acc + (Number(g.monthly_value) || 0), 0);

  // formatar saúde (capitalize)
  const formatHealth = (h) => {
    if (!h) return "-";
    try {
      return String(h).charAt(0).toUpperCase() + String(h).slice(1);
    } catch {
      return h;
    }
  };

  // Valores "atuais" que mostramos nos cards:
  // preferimos mostrar summary (que vem do backend com os reserves atuais).
  const currentValue = Number(summary?.current ?? config?.reserve_current ?? 0);
  const cdbValue = Number(summary?.cdb ?? config?.reserve_cdb ?? 0);
  const extraValue = Number(summary?.extra ?? config?.reserve_extra ?? 0);
  const fgtsValue = Number(summary?.fgts ?? config?.reserve_fgts ?? config?.fgts ?? 0);

  const chartTooltipStyle = {
  backgroundColor: 'rgba(20, 25, 35, 0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(12px)'
  };

  const chartLabelStyle = { color: 'var(--text-secondary)' };

  return (
    <div className="finance-page">
      <div className="finance-header">
        <h1>Financeiro</h1>
        <button className="icon-btn" onClick={() => setShowConfig(true)}>
          <Settings size={22} />
        </button>
      </div>

      {/* DASHBOARD (cards principais) */}
      <div className="finance-grid">
        <div className="card finance-card">
          <div className="finance-label">Patrimônio Total</div>
          <div className="finance-value">
            R$ {Number(summary?.patrimonio_total || 0).toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Conta Corrente</div>
          <div className="finance-value">
            R$ {currentValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">CDB</div>
          <div className="finance-value">
            R$ {cdbValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Reserva Extra</div>
          <div className="finance-value">
            R$ {extraValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">FGTS</div>
          <div className="finance-value">
            R$ {fgtsValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Saldo Mensal</div>
          <div className="finance-value">
            R$ {Number(summary?.saldo_disponivel || 0).toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">% Economia</div>
          <div className="finance-value">
            {summary?.percentual_economia || 0}%
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Saúde Financeira</div>
          <div className="finance-value">
            {formatHealth(summary?.health_indicator)}
          </div>
        </div>
      </div>

{/* PROJEÇÃO FINANCEIRA */}
<div className="card finance-card">
  <h3>Projeção Patrimonial (10 anos)</h3>

  {projection.length > 0 && (
    <div className="finance-chart-wrapper">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={projection} margin={{ top: 20, right: 30, left: 10, bottom: 10 }} >
    {/* DEFINIÇÕES DE GRADIENTE */}
    <defs>
  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={chartColors.total} stopOpacity={0.4}/>
<stop offset="95%" stopColor={chartColors.total} stopOpacity={0}/>
  </linearGradient>
</defs>
              <CartesianGrid 
  stroke="rgba(255,255,255,0.08)" 
  strokeDasharray="3 3" 
/>

<XAxis 
  dataKey="month" 
  stroke="rgba(255,255,255,0.5)" 
  tick={{ fill: "rgba(255,255,255,0.6)" }} 
/>
				<Tooltip
					contentStyle={chartTooltipStyle}
					labelStyle={chartLabelStyle}
					formatter={(value, name) =>
					[`R$ ${Number(value).toLocaleString("pt-BR")}`, name]
				}
			/>
              <Legend verticalAlign="bottom" height={36} />
              {/* total */}
              <Line
  type="natural"
  dataKey="total"
  stroke={chartColors.total}
  strokeWidth={3}
  dot={false}
  name="Total"
  fill="url(#colorTotal)"
/>

<Line
  type="natural"
  dataKey="current"
  stroke={chartColors.current}
  strokeWidth={2}
  dot={false}
  name="Conta Corrente"
/>

<Line
  type="natural"
  dataKey="cdb"
  stroke={chartColors.cdb}
  strokeWidth={2}
  dot={false}
  name="CDB"
/>

<Line
  type="natural"
  dataKey="extra"
  stroke={chartColors.extra}
  strokeWidth={2}
  dot={false}
  name="Extra"
/>

<Line
  type="natural"
  dataKey="fgts"
  stroke={chartColors.fgts}
  strokeWidth={2}
  dot={false}
  name="FGTS"
/>
            </LineChart>
          </ResponsiveContainer>
		  </div>
        )}
      </div>

      {/* CARDS DE RESUMO (valores atuais individuais) */}
      <div className="finance-grid finance-grid--spaced">
        <div className="card finance-card">
          <div className="finance-label">Valor Conta Corrente (atual)</div>
          <div className="finance-value">
            R$ {currentValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Valor CDB (atual)</div>
          <div className="finance-value">
            R$ {cdbValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Valor Extra (atual)</div>
          <div className="finance-value">
            R$ {extraValue.toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="card finance-card">
          <div className="finance-label">Valor FGTS (atual)</div>
          <div className="finance-value">
            R$ {fgtsValue.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* CARD GRANDE: LISTA DE GASTOS FIXOS + TOTAL */}
      <div className="card finance-card finance-card--spaced">
        <h3>Gastos Fixos Mensais</h3>

        <div className="finance-expenses-list">
          {gastosFixos.length === 0 && <div>Nenhum gasto fixo cadastrado.</div>}

          {gastosFixos.map((g) => (
            <div key={g.id} className="finance-expense-inline-row">
              <div className="finance-expense-name">{g.name}</div>
              <div>R$ {Number(g.monthly_value).toLocaleString('pt-BR')}</div>
            </div>
          ))}

          <div className="finance-expense-total">
            <div>Total</div>
            <div>R$ {Number(totalGastosFixos).toLocaleString('pt-BR')}</div>
          </div>
        </div>
      </div>

      {/* MODAL CONFIG */}
      {showConfig && (
        <div className="modal-overlay">
          <div className="modal-card glass-scrollbar">
            <h3>Configuração Financeira</h3>

            <div className="form-grid">

              {/* SALÁRIO */}
              <div className="form-group">
                <label>Salário Mensal</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.salary_monthly || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      salary_monthly: Number(e.target.value)
                    })
                  }
                />
              </div>

              {/* 13º SALÁRIO */}
              <div className="form-group">
                <label>13º Salário</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.thirteenth || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      thirteenth: Number(e.target.value)
                    })
                  }
                />
              </div>

              {/* CDI */}
              <div className="form-group">
                <label>CDI Anual (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.cdi_rate_annual || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      cdi_rate_annual: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>% do CDI - CDB</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.cdb_percent_cdi || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      cdb_percent_cdi: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>% do CDI - Extra</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.extra_percent_cdi || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      extra_percent_cdi: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Juros Anual Conta Corrente (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.interest_rate_current || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      interest_rate_current: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Reserva Corrente</label>
                <input
                  type="number"
                  value={config.reserve_current || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      reserve_current: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Reserva CDB</label>
                <input
                  type="number"
                  value={config.reserve_cdb || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      reserve_cdb: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Reserva Extra</label>
                <input
                  type="number"
                  value={config.reserve_extra || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      reserve_extra: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Saldo Atual FGTS</label>
                <input
                  type="number"
                  value={config.reserve_fgts || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      reserve_fgts: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Depósito Mensal FGTS</label>
                <input
                  type="number"
                  value={config.fgts || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      fgts: Number(e.target.value)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Aporte Mensal (vai para CDB)</label>
                <input
                  type="number"
                  value={config.monthly_contribution || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      monthly_contribution: Number(e.target.value)
                    })
                  }
                />
              </div>

            </div>

            <hr className="finance-divider" />

            <h4>Gastos Fixos</h4>

            {gastosFixos.map((g) => (
              <div key={g.id} className="expense-row">

                {editandoId === g.id ? (
                  <>
                    <input
                      value={editGasto.name}
                      onChange={(e) =>
                        setEditGasto({ ...editGasto, name: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      value={editGasto.monthly_value}
                      onChange={(e) =>
                        setEditGasto({
                          ...editGasto,
                          monthly_value: e.target.value
                        })
                      }
                    />
                    <button onClick={() => handleSaveEdit(g.id)} className="emoji-btn">
                      ✅
                    </button>
                  </>
                ) : (
                  <>
                    <span>{g.name}</span>
                    <span>
                      R$ {Number(g.monthly_value).toLocaleString('pt-BR')}
                    </span>
                    <button onClick={() => handleStartEdit(g)} className="emoji-btn">
                      ✏️
                    </button>
                    <button onClick={() => handleDeleteGasto(g.id)} className="emoji-btn delete">
                      🗑️
                    </button>
                  </>
                )}

              </div>
            ))}

            <div className="add-expense-row">
              <input
                type="text"
                placeholder="Serviço"
                value={novoGasto.name}
                onChange={(e) =>
                  setNovoGasto({ ...novoGasto, name: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Valor Mensal"
                value={novoGasto.monthly_value}
                onChange={(e) =>
                  setNovoGasto({ ...novoGasto, monthly_value: e.target.value })
                }
              />

              <button onClick={handleAddGasto} className="emoji-btn add">
                ➕
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowConfig(false)}>
                Cancelar
              </button>

              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financeiro;
