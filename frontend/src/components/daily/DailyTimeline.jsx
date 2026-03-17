import React from "react";
import "./DailyTimeline.css";
import { addMinutesToTime, formatDuration, isBlockCompleted } from "../../hooks/daily/utils";

export default function DailyTimeline({ blocks, loadState, onToggleCompletion, onEditBlock }) {
  if (loadState.status === "loading") return <div className="daily-loading">Carregando...</div>;
  if (loadState.status === "error") return <div className="daily-status daily-status--error">{loadState.error}</div>;

  return (
    <div className="daily-timeline">
      {blocks.length === 0 && <div className="daily-empty">Nenhum plano gerado para este dia.</div>}
      {blocks.map(block => {
        const endTime = addMinutesToTime(block.start_time, block.duration);
        const completed = isBlockCompleted(block.completed);
        const canEdit = block.source_type !== "calendar";
        return (
          <div
  key={block.id}
className={`daily-block daily-block--${block.block_category} ${completed ? "completed" : ""}`}
>
            <div className="daily-block__left">
              <input
                type="checkbox"
                checked={completed}
                onChange={() => onToggleCompletion(block.id, completed, block)}
                className="daily-block__checkbox"
              />
              <div className="daily-block__meta">
                <div className="daily-block__time">{block.start_time} - {endTime}</div>
                <div className="daily-block__duration">{formatDuration(block.duration)}</div>
              </div>
            </div>
            <div className="daily-block__name">{block.activity_title || "Bloco fixo"}</div>
            <div className="daily-block__right">
              {canEdit ? (
                <button type="button" className="daily-block__edit" onClick={() => onEditBlock(block)}>
                  Editar
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
