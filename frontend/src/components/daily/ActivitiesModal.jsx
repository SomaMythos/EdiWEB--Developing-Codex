import React, { useRef } from "react";
import "./ActivitiesModal.css";
import { formatFixedTime, getFrequencyLabel, parseIntegerOrFallback } from "../../hooks/daily/utils";
import AccessibleModal from "./AccessibleModal";

export default function ActivitiesModal({
  show,
  activities,
  newActivity,
  setNewActivity,
  validationErrors = {},
  state,
  onFrequencyChange,
  onToggleActivity,
  onDeleteActivity,
  onCreateActivity,
  onClose
}) {
  const titleInputRef = useRef(null);
  if (!show) return null;

  return (
    <AccessibleModal
      show={show}
      title="Atividades"
      onClose={onClose}
      initialFocusRef={titleInputRef}
      size="wide"
      className="activities-modal"
    >
      <div className="activities-list">
        {activities.map(a => (
          <div key={a.id} className="activity-item">
            <div>
              <strong>{a.title}</strong>
              <div className="activity-meta">{a.min_duration === a.max_duration ? `${a.min_duration} min` : `${a.min_duration} - ${a.max_duration} min`}</div>
              <div className="activity-meta">
                {getFrequencyLabel(a.frequency_type)}
                {formatFixedTime(a.fixed_time) ? ` • Horário fixo ${formatFixedTime(a.fixed_time)}` : ""}
                {a.fixed_duration ? ` • Duração fixa ${a.fixed_duration} min` : ""}
                {a.is_disc ? " • Disciplina" : ""}
                {a.is_fun ? " • Diversão" : ""}
              </div>
            </div>
            <div className="activity-actions">
              <button className="btn btn-secondary" onClick={() => onToggleActivity(a.id)}>{a.active ? "Desativar" : "Ativar"}</button>
              <button className="btn btn-danger" onClick={() => window.confirm("Excluir atividade permanentemente?") && onDeleteActivity(a.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <h4>Nova Atividade</h4>
      <div className="activities-form">
        <input
          ref={titleInputRef}
          className={validationErrors.title ? "activities-input--error" : ""}
          placeholder="Título"
          value={newActivity.title}
          onChange={e => setNewActivity({ ...newActivity, title: e.target.value })}
        />
        {validationErrors.title && <span className="activities-error">{validationErrors.title}</span>}
        <div className="activities-form-row">
          <div className="activities-field">
            <input
              className={validationErrors.min_duration ? "activities-input--error" : ""}
              type="number"
              placeholder="Mín (min)"
              value={newActivity.min_duration}
              onChange={e => setNewActivity({ ...newActivity, min_duration: parseIntegerOrFallback(e.target.value, 0) })}
            />
            {validationErrors.min_duration && <span className="activities-error">{validationErrors.min_duration}</span>}
          </div>
          <div className="activities-field">
            <input
              className={validationErrors.max_duration ? "activities-input--error" : ""}
              type="number"
              placeholder="Máx (min)"
              value={newActivity.max_duration}
              onChange={e => setNewActivity({ ...newActivity, max_duration: parseIntegerOrFallback(e.target.value, 0) })}
            />
            {validationErrors.max_duration && <span className="activities-error">{validationErrors.max_duration}</span>}
          </div>
        </div>
        <div className="activities-frequency">
          {[
            ["flex", "Flexível"],
            ["everyday", "Todo Dia"],
            ["workday", "Work Day"],
            ["offday", "Off Day"]
          ].map(([value, label]) => (
            <label key={value}><input type="radio" name="frequency" checked={newActivity.frequency_type === value} onChange={() => onFrequencyChange(value)} /> {label}</label>
          ))}
        </div>

        {newActivity.frequency_type !== "flex" && (
          <div className="activities-form-row">
            <div className="activities-field">
              <input
                className={validationErrors.fixed_time ? "activities-input--error" : ""}
                type="time"
                value={newActivity.fixed_time}
                onChange={e => setNewActivity({ ...newActivity, fixed_time: e.target.value })}
              />
              {validationErrors.fixed_time && <span className="activities-error">{validationErrors.fixed_time}</span>}
            </div>
            <div className="activities-field">
              <input
                className={validationErrors.fixed_duration ? "activities-input--error" : ""}
                type="number"
                placeholder="Duração fixa (opcional)"
                value={newActivity.fixed_duration}
                onChange={e =>
                  setNewActivity({
                    ...newActivity,
                    fixed_duration: e.target.value === "" ? "" : parseIntegerOrFallback(e.target.value, "")
                  })
                }
              />
              {validationErrors.fixed_duration && <span className="activities-error">{validationErrors.fixed_duration}</span>}
            </div>
          </div>
        )}
        {newActivity.frequency_type !== "flex" && (
          <span className="activity-meta">Horário e duração fixos são opcionais (preencha os dois apenas se quiser travar a atividade).</span>
        )}

        <div className="activities-flags">
          <label><input type="checkbox" checked={newActivity.is_disc} onChange={e => setNewActivity({ ...newActivity, is_disc: e.target.checked })} /> Disciplina</label>
          <label><input type="checkbox" checked={newActivity.is_fun} onChange={e => setNewActivity({ ...newActivity, is_fun: e.target.checked })} /> Diversão</label>
        </div>
        {validationErrors.category && <span className="activities-error">{validationErrors.category}</span>}
        <button className="btn btn-primary" onClick={onCreateActivity}>Criar</button>
      </div>

      {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
      {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

      <div className="daily-modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
      </div>
    </AccessibleModal>
  );
}
