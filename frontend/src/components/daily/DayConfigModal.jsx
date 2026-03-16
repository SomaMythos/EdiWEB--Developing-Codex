import React, { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./DayConfigModal.css";
import { parseIntegerOrFallback } from "../../hooks/daily/utils";
import AccessibleModal from "./AccessibleModal";

function WeightField({ label, value, onChange }) {
  const numericValue = Number(value) || 0;

  return (
    <div className="daily-form-row">
      <label>{label}</label>
      <div className="daily-stepper">
        <input
          type="number"
          value={numericValue}
          onChange={(e) => onChange(parseIntegerOrFallback(e.target.value, 1))}
        />
        <div className="daily-stepper__actions">
          <button type="button" className="daily-stepper__button" onClick={() => onChange(numericValue + 1)} aria-label={`Aumentar ${label.toLowerCase()}`}>
            <ChevronUp size={16} />
          </button>
          <button type="button" className="daily-stepper__button" onClick={() => onChange(Math.max(0, numericValue - 1))} aria-label={`Diminuir ${label.toLowerCase()}`}>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DayConfigModal({ show, config, setConfig, onClose, onSave, state }) {
  const firstInputRef = useRef(null);
  if (!show || !config) return null;

  return (
    <AccessibleModal show={show} title="Configuração do Dia" onClose={onClose} initialFocusRef={firstInputRef}>
      {[["Sono Início", "sleep_start"], ["Sono Fim", "sleep_end"], ["Work Início", "work_start"], ["Work Fim", "work_end"]].map(([label, key]) => (
        <div key={key} className="daily-form-row">
          <label>{label}</label>
          <input
            ref={key === "sleep_start" ? firstInputRef : undefined}
            type="time"
            value={config[key]}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          />
        </div>
      ))}

      <div className="daily-form-row">
        <label>Buffer (min)</label>
        <input
          type="number"
          value={config.buffer_between}
          onChange={(e) => setConfig({ ...config, buffer_between: parseIntegerOrFallback(e.target.value, 0) })}
        />
      </div>

      <WeightField
        label="Peso Disciplina"
        value={config.discipline_weight}
        onChange={(value) => setConfig({ ...config, discipline_weight: value })}
      />

      <WeightField
        label="Peso Diversão"
        value={config.fun_weight}
        onChange={(value) => setConfig({ ...config, fun_weight: value })}
      />

      <label className="daily-checkbox-row">
        <span className="daily-checkbox-row__copy">Evitar categorias adjacentes</span>
        <input
          type="checkbox"
          checked={config.avoid_category_adjacent === 1 || config.avoid_category_adjacent === true}
          onChange={(e) => setConfig({ ...config, avoid_category_adjacent: e.target.checked })}
        />
        <span className="daily-checkbox-row__control" aria-hidden="true" />
      </label>

      {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
      {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

      <div className="daily-modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onSave} disabled={state.status === "loading"}>Salvar</button>
      </div>
    </AccessibleModal>
  );
}
