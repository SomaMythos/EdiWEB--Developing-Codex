import React, { useEffect, useMemo, useRef, useState } from "react";
import AccessibleModal from "./AccessibleModal";
import "./CountersModal.css";

const COUNTER_TABS = [
  ["open", "Em aberto"],
  ["completed", "Historico"]
];

function formatDateLabel(value) {
  if (!value) return "--";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("pt-BR");
}

function formatAverageLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "Sem media ainda";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "Sem media ainda";
  }

  return Number.isInteger(numericValue)
    ? `${numericValue} dias`
    : `${numericValue.toFixed(1)} dias`;
}

function formatElapsedLabel(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue === 1 ? "1 dia" : `${numericValue} dias`;
}

export default function CountersModal({
  show,
  counterName,
  setCounterName,
  counters,
  summary,
  validationError,
  state,
  onCreateCounter,
  onCompleteCounter,
  onClose
}) {
  const inputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("open");

  const openCounters = useMemo(
    () => (Array.isArray(counters) ? counters : []).filter(counter => !counter?.is_completed),
    [counters]
  );
  const completedCounters = useMemo(
    () => (Array.isArray(counters) ? counters : []).filter(counter => counter?.is_completed),
    [counters]
  );
  const visibleCounters = activeTab === "open" ? openCounters : completedCounters;
  const averages = Array.isArray(summary?.averages) ? summary.averages : [];

  useEffect(() => {
    if (!show) return;
    if (activeTab === "open" && openCounters.length > 0) return;
    if (activeTab === "completed" && completedCounters.length > 0) return;

    if (openCounters.length > 0) {
      setActiveTab("open");
      return;
    }

    if (completedCounters.length > 0) {
      setActiveTab("completed");
    }
  }, [activeTab, completedCounters.length, openCounters.length, show]);

  if (!show) return null;

  return (
    <AccessibleModal
      show={show}
      title="Contadores"
      onClose={onClose}
      initialFocusRef={inputRef}
      size="wide"
      className="counters-modal"
    >
      <div className="counters-modal__layout">
        <section className="counters-panel counters-panel--form page-shell">
          <div className="counters-panel__head">
            <div>
              <span className="counters-kicker">Novo</span>
              <h4>Registrar contador</h4>
            </div>
          </div>

          <div className="counters-stats">
            <article className="counters-stat-card">
              <span>Em aberto</span>
              <strong>{summary?.open_count || 0}</strong>
            </article>
            <article className="counters-stat-card">
              <span>Concluidos</span>
              <strong>{summary?.completed_count || 0}</strong>
            </article>
          </div>

          <label className="counters-field">
            <span>Nome</span>
            <input
              ref={inputRef}
              className={`input ${validationError ? "counters-input--error" : ""}`}
              placeholder="Ex.: Lavar roupas"
              value={counterName}
              onChange={event => setCounterName(event.target.value)}
            />
            {validationError ? <span className="counters-error">{validationError}</span> : null}
          </label>

          <p className="counters-helper">
            Ao registrar, a data inicial fica salva automaticamente. Depois o item aparece na lista ate voce concluir.
          </p>

          <div className="counters-form__actions">
            <button type="button" className="btn btn-primary" onClick={onCreateCounter}>
              Registrar contador
            </button>
          </div>

          <div className="counters-averages">
            <div className="counters-panel__head counters-panel__head--compact">
              <div>
                <span className="counters-kicker">Medias</span>
                <h4>Base para intercalar</h4>
              </div>
            </div>

            {averages.length ? (
              <div className="counters-average-list glass-scrollbar">
                {averages.map(item => (
                  <article key={`${item.title}-${item.last_completed_at}`} className="counters-average-card">
                    <strong>{item.title}</strong>
                    <span>{formatAverageLabel(item.average_elapsed_days)}</span>
                    <small>{item.completed_cycles} ciclo(s) concluídos</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="counters-empty">As médias vão aparecer aqui depois dos primeiros ciclos concluídos.</p>
            )}
          </div>
        </section>

        <section className="counters-panel counters-panel--list page-shell">
          <div className="counters-panel__head">
            <div>
              <span className="counters-kicker">Lista</span>
              <h4>Contadores registrados</h4>
            </div>
            <small>{visibleCounters.length} item(ns)</small>
          </div>

          <div className="counters-tabs" role="tablist" aria-label="Filtrar contadores">
            {COUNTER_TABS.map(([value, label]) => {
              const count = value === "open" ? openCounters.length : completedCounters.length;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === value}
                  className={`counters-tab ${activeTab === value ? "active" : ""}`}
                  onClick={() => setActiveTab(value)}
                >
                  <span>{label}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>

          <div className="counters-list glass-scrollbar">
            {visibleCounters.length ? (
              visibleCounters.map(counter => (
                <article key={counter.id} className={`counter-item ${counter.is_completed ? "is-completed" : "is-open"}`}>
                  <div className="counter-item__body">
                    <div className="counter-item__title-row">
                      <strong>{counter.title}</strong>
                      {counter.is_completed && formatElapsedLabel(counter.elapsed_days) ? (
                        <span className="counter-item__elapsed">{formatElapsedLabel(counter.elapsed_days)}</span>
                      ) : null}
                    </div>

                    <div className="counter-item__meta">
                        <span>Início {formatDateLabel(counter.started_at)}</span>
                      {counter.is_completed ? (
                          <span>Conclusão {formatDateLabel(counter.completed_at)}</span>
                      ) : (
                        <span>{formatElapsedLabel(counter.days_since_start) || "Registrado hoje"}</span>
                      )}
                      {counter.completed_cycles > 0 ? (
                        <span>Média {formatAverageLabel(counter.average_elapsed_days)}</span>
                      ) : null}
                    </div>
                  </div>

                  {!counter.is_completed ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onCompleteCounter(counter.id)}
                    >
                      Concluir
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="counters-empty">
                {activeTab === "open"
                  ? "Nenhum contador em aberto no momento."
                  : "Nenhum ciclo concluído ainda."}
              </p>
            )}
          </div>
        </section>
      </div>

      {state.status === "error" ? <div className="daily-status daily-status--error">{state.error}</div> : null}
      {state.status === "success" && state.successMessage ? (
        <div className="daily-status daily-status--success">{state.successMessage}</div>
      ) : null}

      <div className="daily-modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </AccessibleModal>
  );
}
