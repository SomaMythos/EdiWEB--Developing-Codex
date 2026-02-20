import React from "react";
import "./ActivitiesModal.css";
import { formatFixedTime, getFrequencyLabel, parseIntegerOrFallback } from "../../hooks/daily/utils";

export default function ActivitiesModal({
  show,
  activities,
  newActivity,
  setNewActivity,
  state,
  onFrequencyChange,
  onToggleActivity,
  onDeleteActivity,
  onCreateActivity,
  onClose
}) {
  if (!show) return null;

  return (
    <div className="activities-overlay">
      <div className="activities-modal">
        <h3>Atividades</h3>
        <div className="activities-list">
          {activities.map(a => (
            <div key={a.id} className="activity-item">
              <div>
                <strong>{a.title}</strong>
                <div className="activity-meta">{a.min_duration === a.max_duration ? `${a.min_duration} min` : `${a.min_duration} - ${a.max_duration} min`}</div>
                <div className="activity-meta">
                  {getFrequencyLabel(a.frequency_type)}
                  {a.frequency_type !== "flex" && formatFixedTime(a.fixed_time) ? ` • Horário fixo ${formatFixedTime(a.fixed_time)}` : ""}
                  {a.frequency_type !== "flex" && a.fixed_duration ? ` • Duração fixa ${a.fixed_duration} min` : ""}
                  {a.is_disc ? " • Disciplina" : ""}
                  {a.is_fun ? " • Diversão" : ""}
                </div>
              </div>
              <div className="activity-actions">
                <button className="daily-button daily-button--secondary" onClick={() => onToggleActivity(a.id)}>{a.active ? "Desativar" : "Ativar"}</button>
                <button className="daily-button daily-button--danger" onClick={() => window.confirm("Excluir atividade permanentemente?") && onDeleteActivity(a.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>

        <h4>Nova Atividade</h4>
        <div className="activities-form">
          <input placeholder="Título" value={newActivity.title} onChange={e => setNewActivity({ ...newActivity, title: e.target.value })} />
          <div className="activities-form-row">
            <input type="number" placeholder="Mín (min)" value={newActivity.min_duration} onChange={e => setNewActivity({ ...newActivity, min_duration: parseIntegerOrFallback(e.target.value, 0) })} />
            <input type="number" placeholder="Máx (min)" value={newActivity.max_duration} onChange={e => setNewActivity({ ...newActivity, max_duration: parseIntegerOrFallback(e.target.value, 0) })} />
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
              <input type="time" value={newActivity.fixed_time} onChange={e => setNewActivity({ ...newActivity, fixed_time: e.target.value })} />
              <input type="number" placeholder="Duração (min)" value={newActivity.fixed_duration} onChange={e => setNewActivity({ ...newActivity, fixed_duration: parseIntegerOrFallback(e.target.value, 0) })} />
            </div>
          )}

          <div className="activities-flags">
            <label><input type="checkbox" checked={newActivity.is_disc} onChange={e => setNewActivity({ ...newActivity, is_disc: e.target.checked, is_fun: false })} /> Disciplina</label>
            <label><input type="checkbox" checked={newActivity.is_fun} onChange={e => setNewActivity({ ...newActivity, is_fun: e.target.checked, is_disc: false })} /> Diversão</label>
          </div>
          <button className="daily-button daily-button--primary" onClick={onCreateActivity}>Criar</button>
        </div>

        {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
        {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

        <div className="daily-modal-actions">
          <button className="daily-button daily-button--secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
