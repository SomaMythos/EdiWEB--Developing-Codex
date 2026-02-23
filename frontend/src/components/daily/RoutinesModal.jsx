import React, { useRef } from "react";
import "./RoutinesModal.css";
import AccessibleModal from "./AccessibleModal";

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
  const createRoutineButtonRef = useRef(null);
  if (!show) return null;

  return (
    <AccessibleModal
      show={show}
      title={`Rotina (${dayType})`}
      onClose={onClose}
      initialFocusRef={createRoutineButtonRef}
      size="wide"
    >

        {!activeRoutine && (
          <div className="daily-empty-state">
            <div className="daily-empty-text">Nenhuma rotina configurada para este tipo de dia.</div>
            <button ref={createRoutineButtonRef} className="btn btn-primary" onClick={onCreateRoutine}>
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
            <button className="btn btn-secondary" onClick={() => onRemoveBlock(block.id)}>Remover</button>
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
            <button className="btn btn-primary" onClick={onAddBlock}>Adicionar</button>
          </>
        )}

        {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
        {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

        <div className="daily-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
    </AccessibleModal>
  );
}
