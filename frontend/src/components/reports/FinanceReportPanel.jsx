import React from 'react';
import { Bell, Clock, ShoppingCart, Wallet } from 'lucide-react';

const FinanceReportPanel = ({ moduleSummary }) => {
  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Financeiro</h2>
        <p>Pendências financeiras e indicadores conectados aos outros módulos.</p>
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
            <p className="stat-label">Status</p>
            <p className="stat-value">Em acompanhamento</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinanceReportPanel;
