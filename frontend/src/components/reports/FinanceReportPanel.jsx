import React from 'react';
import { Bell, Clock, ShoppingCart, Wallet } from 'lucide-react';

const FinanceReportPanel = ({ moduleSummary, financeSummary }) => {
  const equitySeries = financeSummary?.equity_monthly_variation || [];
  const lastEquity = equitySeries.length ? equitySeries[equitySeries.length - 1] : null;

  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Finance Analytics</h2>
        <p>Comparativos mensais, outliers de gasto e evolução do patrimônio.</p>
      </header>

      <div className="report-grid report-grid--two">
        <div className="stat-card">
          <div className="stat-icon primary"><Wallet size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Gastos fixos</p>
            <p className="stat-value">{moduleSummary.financeFixedExpenses}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><ShoppingCart size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Itens não comprados</p>
            <p className="stat-value">{moduleSummary.shoppingPending}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Bell size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Notificações pendentes</p>
            <p className="stat-value">{moduleSummary.notifications}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><Clock size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Gasto no mês</p>
            <p className="stat-value">R$ {Number(financeSummary?.monthly_total_expense || 0).toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <div className="report-grid report-grid--two">
        <article className="goal-overview-card">
          <p className="stat-label">Economia vs mês anterior</p>
          <p className="stat-value">R$ {Number(financeSummary?.savings_vs_previous_month || 0).toLocaleString('pt-BR')}</p>
          <p className="empty-state">Ref.: {financeSummary?.reference_month || '-'}</p>
        </article>
        <article className="goal-overview-card">
          <p className="stat-label">Patrimônio acumulado</p>
          <p className="stat-value">R$ {Number(lastEquity?.total_equity || 0).toLocaleString('pt-BR')}</p>
          <p className="empty-state">Mês: {lastEquity?.month || '-'}</p>
        </article>
      </div>

      <div className="report-grid report-grid--two">
        <article className="goal-overview-card">
          <p className="stat-label">Maior gasto no período</p>
          <p className="stat-value">R$ {Number(financeSummary?.largest_expense || 0).toLocaleString('pt-BR')}</p>
        </article>
        <article className="goal-overview-card">
          <p className="stat-label">Menor gasto no período</p>
          <p className="stat-value">R$ {Number(financeSummary?.smallest_expense || 0).toLocaleString('pt-BR')}</p>
        </article>
      </div>
    </section>
  );
};

export default FinanceReportPanel;
