import React from "react";
import { Settings } from "lucide-react";
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
  onOpenActivities,
  onOpenCounters,
  actionState
}) {
  return (
    <div className="daily-header">
      <div className="daily-header__left">
        <h2 className="daily-header__title">Visão do dia</h2>

        <button
          type="button"
          className={`daily-header__badge ${dayType === "work" ? "work" : "off"}`}
          onClick={onToggleDay}
          title={dayType === "work" ? "Trocar para off day" : "Trocar para work day"}
        >
          {dayType === "work" ? "WORK DAY" : "OFF DAY"}
        </button>

        <div className="daily-header__progress-container">
          <div
            className="daily-header__progress-bar"
            style={{ width: `${summary.percentage}%` }}
          />
        </div>

        <div className="daily-header__progress-text">
          {summary.completed_blocks}/{summary.total_blocks} concluídos
        </div>

        {blocks.length > 0 && (
          <div className="daily-header__summary-card">
            <div>
              <div className="daily-header__summary-label">Total planejado</div>
              <div className="daily-header__summary-value">
                {formatDuration(totalDuration)}
              </div>
            </div>

            <div>
              <div className="daily-header__summary-label">Concluído</div>
              <div className="daily-header__summary-value">
                {formatDuration(completedDuration)}
              </div>
            </div>

            <div>
              <div className="daily-header__summary-label">Progresso</div>
              <div className="daily-header__summary-value">
                {summary.percentage}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="daily-header__controls">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="daily-input"
        />

        <div className="daily-header__actions">
          <button onClick={onGenerate} className="btn btn-primary" disabled={generating}>
            {generating ? "Gerando..." : "Gerar dia"}
          </button>

          <button onClick={onOpenActivities} className="btn btn-secondary daily-header__activities-button">
            Atividades
          </button>

          <button onClick={onOpenCounters} className="btn btn-secondary daily-header__activities-button">
            Contadores
          </button>

          <button
            onClick={onOpenConfig}
            className="daily-header__settings-button"
            title="Configurações do dia"
            aria-label="Configurações do dia"
            type="button"
          >
            <Settings size={22} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      {actionState?.status === "error" && (
        <div className="daily-status daily-status--error">
          {actionState.error}
        </div>
      )}

      {actionState?.status === "success" && actionState.successMessage && (
        <div className="daily-status daily-status--success">
          {actionState.successMessage}
        </div>
      )}
    </div>
  );
}
