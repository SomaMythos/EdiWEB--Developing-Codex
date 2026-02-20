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
        return (
          <div key={block.id} className={`daily-block ${completed ? "completed" : ""}`}>
            <div className="daily-block__left">
              <input
                type="checkbox"
                checked={completed}
                onChange={() => onToggleCompletion(block.id, completed)}
                className="daily-block__checkbox"
              />
              <div>
                <div className="daily-block__time">{block.start_time} - {endTime}</div>
                <div className="daily-block__duration">{formatDuration(block.duration)}</div>
              </div>
            </div>
            <div className="daily-block__right">
              <div className="daily-block__name">{block.activity_title || "Bloco fixo"}</div>
              <button type="button" className="daily-block__edit" onClick={() => onEditBlock(block)}>
                Editar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
