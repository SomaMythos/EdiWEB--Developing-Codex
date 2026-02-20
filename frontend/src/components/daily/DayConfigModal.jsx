import React from "react";
import "./DayConfigModal.css";
import { parseIntegerOrFallback } from "../../hooks/daily/utils";

export default function DayConfigModal({ show, config, setConfig, onClose, onSave, state }) {
  if (!show || !config) return null;

  return (
    <div className="daily-modal-overlay">
      <div className="daily-modal">
        <h3>Configuração do Dia</h3>
        {[ ["Sono Início", "sleep_start"], ["Sono Fim", "sleep_end"], ["Work Início", "work_start"], ["Work Fim", "work_end"] ].map(([label, key]) => (
          <div key={key} className="daily-form-row">
            <label>{label}</label>
            <input type="time" value={config[key]} onChange={e => setConfig({ ...config, [key]: e.target.value })} />
          </div>
        ))}
        <div className="daily-form-row">
          <label>Buffer (min)</label>
          <input type="number" value={config.buffer_between} onChange={e => setConfig({ ...config, buffer_between: parseIntegerOrFallback(e.target.value, 0) })} />
        </div>
        <div className="daily-form-row">
          <label>Peso Disciplina</label>
          <input type="number" value={config.discipline_weight} onChange={e => setConfig({ ...config, discipline_weight: parseIntegerOrFallback(e.target.value, 1) })} />
        </div>
        <div className="daily-form-row">
          <label>Peso Diversão</label>
          <input type="number" value={config.fun_weight} onChange={e => setConfig({ ...config, fun_weight: parseIntegerOrFallback(e.target.value, 1) })} />
        </div>
        <div className="daily-form-row">
          <label>
            <input
              type="checkbox"
              checked={config.avoid_category_adjacent === 1 || config.avoid_category_adjacent === true}
              onChange={e => setConfig({ ...config, avoid_category_adjacent: e.target.checked })}
            />
            Evitar categorias adjacentes
          </label>
        </div>

        {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
        {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

        <div className="daily-modal-actions">
          <button className="daily-button daily-button--secondary" onClick={onClose}>Cancelar</button>
          <button className="daily-button daily-button--primary" onClick={onSave} disabled={state.status === "loading"}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
