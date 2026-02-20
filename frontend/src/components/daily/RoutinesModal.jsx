import React from "react";
import "./RoutinesModal.css";

export default function RoutinesModal({
  show,
  dayType,
  activeRoutine,
  routineBlocks,
  newBlock,
  setNewBlock,
  state,
  onCreateRoutine,
  onAddBlock,
  onRemoveBlock,
  onClose
}) {
  if (!show) return null;

  return (
    <div className="daily-modal-overlay">
      <div className="daily-modal daily-modal--wide">
        <h3>Rotina ({dayType})</h3>

        {!activeRoutine && (
          <div className="daily-empty-state">
            <div className="daily-empty-text">Nenhuma rotina configurada para este tipo de dia.</div>
            <button className="daily-button daily-button--primary" onClick={onCreateRoutine}>
              Criar rotina {dayType === "work" ? "Work" : "Off"}
            </button>
          </div>
        )}

        {routineBlocks.map(block => (
          <div key={block.id} className="routine-item">
            <div>
              <strong>{block.name}</strong>
              <div className="routine-time">{block.start_time} - {block.end_time}</div>
            </div>
            <button className="daily-button daily-button--secondary" onClick={() => onRemoveBlock(block.id)}>Remover</button>
          </div>
        ))}

        {activeRoutine && (
          <>
            <h4>Novo Bloco</h4>
            <div className="daily-form-row">
              <input placeholder="Nome" value={newBlock.name} onChange={e => setNewBlock({ ...newBlock, name: e.target.value })} />
            </div>
            <div className="routine-time-row">
              <input type="time" value={newBlock.start_time} onChange={e => setNewBlock({ ...newBlock, start_time: e.target.value })} />
              <input type="time" value={newBlock.end_time} onChange={e => setNewBlock({ ...newBlock, end_time: e.target.value })} />
            </div>
            <button className="daily-button daily-button--primary" onClick={onAddBlock}>Adicionar</button>
          </>
        )}

        {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
        {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

        <div className="daily-modal-actions">
          <button className="daily-button daily-button--secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
