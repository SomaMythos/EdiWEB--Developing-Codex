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
        <h2 className="daily-header__title">Visão do dia</h2>

        <div className={`daily-header__badge ${dayType === "work" ? "work" : "off"}`}>
          {dayType === "work" ? "WORK DAY" : "OFF DAY"}
        </div>

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
              <div className="daily-header__summary-label">Total Planejado</div>
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
          onChange={e => onDateChange(e.target.value)}
          className="daily-input"
        />

        <div className="daily-header__actions">
          <button
            onClick={onGenerate}
            className="btn btn-primary"
            disabled={generating}
          >
            {generating ? "Gerando..." : "Gerar dia"}
          </button>

          <button
            onClick={onToggleDay}
            className="btn btn-secondary"
          >
            Alternar tipo de dia
          </button>

          <button
            onClick={onOpenConfig}
            className="btn btn-ghost"
          >
            Configuração
          </button>

          <button
            onClick={onOpenRoutines}
            className="btn btn-ghost"
          >
            Rotinas
          </button>

          <button
            onClick={onOpenActivities}
            className="btn btn-ghost"
          >
            Atividades
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