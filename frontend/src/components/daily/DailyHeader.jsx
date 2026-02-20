import React from "react";
import "./DailyHeader.css";
import { formatDuration } from "../../hooks/daily/utils";

export default function DailyHeader({
  dayType,
  selectedDate,
  onDateChange,
  summary,
  blocks,
  completedDuration,
  totalDuration,
  generating,
  onGenerate,
  onToggleDay,
  onOpenConfig,
  onOpenRoutines,
  onOpenActivities,
  actionState
}) {
  return (
    <div className="daily-header">
      <div className="daily-header__left">
        <h2 className="daily-header__title">Agenda do Dia</h2>
        <div className={`daily-header__badge ${dayType === "work" ? "work" : "off"}`}>
          {dayType === "work" ? "WORK DAY" : "OFF DAY"}
        </div>

        <div className="daily-header__progress-container">
          <div className="daily-header__progress-bar" style={{ width: `${summary.percentage}%` }} />
        </div>
        <div className="daily-header__progress-text">
          {summary.completed_blocks}/{summary.total_blocks} concluídos
        </div>

        {blocks.length > 0 && (
          <div className="daily-header__summary-card">
            <div>
              <div className="daily-header__summary-label">Total Planejado</div>
              <div className="daily-header__summary-value">{formatDuration(totalDuration)}</div>
            </div>
            <div>
              <div className="daily-header__summary-label">Concluído</div>
              <div className="daily-header__summary-value">{formatDuration(completedDuration)}</div>
            </div>
            <div>
              <div className="daily-header__summary-label">Progresso</div>
              <div className="daily-header__summary-value">{summary.percentage}%</div>
            </div>
          </div>
        )}
      </div>

      <div className="daily-header__controls">
        <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)} className="daily-input" />
        <button onClick={onGenerate} className="daily-button daily-button--primary" disabled={generating}>
          {generating ? "Gerando..." : "Gerar Dia"}
        </button>
        <button onClick={onToggleDay} className="daily-button daily-button--secondary">Alternar Dia</button>
        <button onClick={onOpenConfig} className="daily-button daily-button--secondary">⚙ Configurar Dia</button>
        <button onClick={onOpenRoutines} className="daily-button daily-button--secondary">🧩 Rotinas</button>
        <button onClick={onOpenActivities} className="daily-button daily-button--secondary">📚 Activities</button>
      </div>

      {actionState?.status === "error" && <div className="daily-status daily-status--error">{actionState.error}</div>}
      {actionState?.status === "success" && actionState.successMessage && (
        <div className="daily-status daily-status--success">{actionState.successMessage}</div>
      )}
    </div>
  );
}
