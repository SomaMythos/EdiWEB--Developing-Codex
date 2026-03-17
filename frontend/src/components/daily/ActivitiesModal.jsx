import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ActivitiesModal.css";
import { formatFixedTime, getFrequencyLabel, parseIntegerOrFallback, usesNeutralActivityCategory } from "../../hooks/daily/utils";
import AccessibleModal from "./AccessibleModal";

const ACTIVITY_TABS = [
  ["everyday", "Todo dia"],
  ["flex", "Flexivel"],
  ["workday", "Work day"],
  ["offday", "Off day"],
  ["intercalate", "Intercalar"]
];

const FREQUENCY_OPTIONS = [
  ["everyday", "Todo dia"],
  ["flex", "Flexivel"],
  ["workday", "Work day"],
  ["offday", "Off day"],
  ["intercalate", "Intercalar"]
];

const getActivityDurationLabel = activity => {
  if (activity?.fixed_time && activity?.fixed_duration) {
    return null;
  }

  const minDuration = Number(activity?.min_duration) || 0;
  const maxDuration = Number(activity?.max_duration) || 0;

  return minDuration === maxDuration
    ? `${minDuration} min`
    : `${minDuration} - ${maxDuration} min`;
};

const getActivityTags = activity => {
  const tags = [getFrequencyLabel(activity?.frequency_type)];
  const usesNeutralCategory = usesNeutralActivityCategory(activity);

  if (activity?.frequency_type === "intercalate" && activity?.intercalate_days) {
    tags.push(`A cada ${activity.intercalate_days} dias`);
  }

  if (formatFixedTime(activity?.fixed_time)) {
    tags.push(`Horario ${formatFixedTime(activity.fixed_time)}`);
  }

  if (activity?.fixed_duration) {
    tags.push(`${activity.fixed_duration} min fixos`);
  }

  if (!usesNeutralCategory) {
    if (activity?.is_disc) tags.push("Disciplina");
    if (activity?.is_fun) tags.push("Diversao");
  }

  return tags;
};

const getActivitySortMinutes = activity => {
  const formattedTime = formatFixedTime(activity?.fixed_time);
  if (!formattedTime) return Number.MAX_SAFE_INTEGER;

  const [hours, minutes] = formattedTime.split(":").map(Number);
  return (hours * 60) + minutes;
};

export default function ActivitiesModal({
  show,
  activities,
  newActivity,
  setNewActivity,
  validationErrors = {},
  state,
  onFrequencyChange,
  onEditActivity,
  editingActivityId,
  onCancelEditing,
  onToggleActivity,
  onDeleteActivity,
  onCreateActivity,
  onClose
}) {
  const titleInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState(ACTIVITY_TABS[0][0]);
  const usesNeutralCategory = usesNeutralActivityCategory(newActivity);
  const orderedActivities = useMemo(
    () => [...(Array.isArray(activities) ? activities : [])]
      .filter(activity => activity && typeof activity === "object")
      .sort((left, right) => {
        if ((left?.active ?? false) !== (right?.active ?? false)) return left?.active ? -1 : 1;
        const timeDifference = getActivitySortMinutes(left) - getActivitySortMinutes(right);
        if (timeDifference !== 0) return timeDifference;
        return (left?.title || left?.name || "").localeCompare(right?.title || right?.name || "", "pt-BR");
      }),
    [activities]
  );
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        ACTIVITY_TABS.map(([value]) => [
          value,
          orderedActivities.filter(activity => (activity?.frequency_type || "flex") === value).length
        ])
      ),
    [orderedActivities]
  );
  const visibleActivities = useMemo(
    () => orderedActivities.filter(activity => (activity?.frequency_type || "flex") === activeTab),
    [activeTab, orderedActivities]
  );

  useEffect(() => {
    const currentCount = tabCounts[activeTab] || 0;
    if (currentCount > 0) return;

    const firstAvailableTab = ACTIVITY_TABS.find(([value]) => (tabCounts[value] || 0) > 0)?.[0];
    setActiveTab(firstAvailableTab || ACTIVITY_TABS[0][0]);
  }, [activeTab, tabCounts]);

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
      <div className="activities-modal__layout">
        <section className="activities-panel activities-panel--list page-shell">
          <div className="activities-panel__head">
            <div>
              <span className="activities-kicker">Base</span>
              <h4>Ativas e disponiveis</h4>
            </div>
            <small>{visibleActivities.length} / {orderedActivities.length}</small>
          </div>

          <div className="activities-tabs" role="tablist" aria-label="Filtrar atividades por frequencia">
            {ACTIVITY_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                className={`activities-tab ${activeTab === value ? "active" : ""}`}
                onClick={() => setActiveTab(value)}
              >
                <span>{label}</span>
                <strong>{tabCounts[value] || 0}</strong>
              </button>
            ))}
          </div>

          <div className="activities-list glass-scrollbar">
            {visibleActivities.length ? (
              visibleActivities.map(activity => (
                <article key={activity.id} className={`activity-item ${activity.active ? "is-active" : "is-inactive"}`}>
                  <div className="activity-item__copy">
                    <div className="activity-item__title-row">
                      <strong>{activity.title || activity.name || "Atividade sem titulo"}</strong>
                      {getActivityDurationLabel(activity) ? (
                        <span className="activity-item__duration">{getActivityDurationLabel(activity)}</span>
                      ) : null}
                    </div>

                    <div className="activity-item__tags">
                      {getActivityTags(activity).map(tag => (
                        <span key={`${activity.id}-${tag}`} className="activity-item__tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="activity-actions">
                    <button className="btn btn-secondary" onClick={() => onEditActivity(activity)}>
                      Editar
                    </button>
                    <button className="btn btn-secondary" onClick={() => onToggleActivity(activity.id)}>
                      {activity.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => window.confirm("Excluir atividade permanentemente?") && onDeleteActivity(activity.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="activities-empty">Nenhuma atividade cadastrada nesta aba.</p>
            )}
          </div>
        </section>

        <section className="activities-panel activities-panel--form page-shell">
          <div className="activities-panel__head">
            <div>
              <span className="activities-kicker">Nova</span>
              <h4>{editingActivityId ? "Editar atividade" : "Criar atividade"}</h4>
            </div>
            {editingActivityId ? (
              <button type="button" className="btn btn-secondary" onClick={onCancelEditing}>
                Cancelar
              </button>
            ) : null}
          </div>

          <div className="activities-form">
            <label className="activities-field">
              <span>Titulo</span>
              <input
                ref={titleInputRef}
                className={`input ${validationErrors.title ? "activities-input--error" : ""}`}
                placeholder="Ex.: Estudo profundo"
                value={newActivity.title}
                onChange={e => setNewActivity({ ...newActivity, title: e.target.value })}
              />
              {validationErrors.title && <span className="activities-error">{validationErrors.title}</span>}
            </label>

            <div className="activities-form-row">
              <label className="activities-field">
                <span>Minimo</span>
                <input
                  className={`input ${validationErrors.min_duration ? "activities-input--error" : ""}`}
                  type="number"
                  placeholder="30"
                  value={newActivity.min_duration}
                  onChange={e => setNewActivity({ ...newActivity, min_duration: parseIntegerOrFallback(e.target.value, 0) })}
                />
                {validationErrors.min_duration && <span className="activities-error">{validationErrors.min_duration}</span>}
              </label>

              <label className="activities-field">
                <span>Maximo</span>
                <input
                  className={`input ${validationErrors.max_duration ? "activities-input--error" : ""}`}
                  type="number"
                  placeholder="60"
                  value={newActivity.max_duration}
                  onChange={e => setNewActivity({ ...newActivity, max_duration: parseIntegerOrFallback(e.target.value, 0) })}
                />
                {validationErrors.max_duration && <span className="activities-error">{validationErrors.max_duration}</span>}
              </label>
            </div>

            <div className="activities-group">
              <span className="activities-group__label">Frequencia</span>
              <div className="activities-chip-grid">
                {FREQUENCY_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`activities-frequency__chip ${newActivity.frequency_type === value ? "active" : ""}`}
                    onClick={() => onFrequencyChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {newActivity.frequency_type === "intercalate" && (
              <label className="activities-field">
                <span>Dias minimos</span>
                <input
                  className={`input ${validationErrors.intercalate_days ? "activities-input--error" : ""}`}
                  type="number"
                  min="1"
                  placeholder="5"
                  value={newActivity.intercalate_days}
                  onChange={e =>
                    setNewActivity({
                      ...newActivity,
                      intercalate_days: e.target.value === "" ? "" : parseIntegerOrFallback(e.target.value, "")
                    })
                  }
                />
                {validationErrors.intercalate_days && <span className="activities-error">{validationErrors.intercalate_days}</span>}
              </label>
            )}

            {newActivity.frequency_type !== "flex" && (
              <div className="activities-form-row">
                <label className="activities-field">
                  <span>Horario</span>
                  <input
                    className={`input ${validationErrors.fixed_time ? "activities-input--error" : ""}`}
                    type="time"
                    value={newActivity.fixed_time}
                    onChange={e => setNewActivity({ ...newActivity, fixed_time: e.target.value })}
                  />
                  {validationErrors.fixed_time && <span className="activities-error">{validationErrors.fixed_time}</span>}
                </label>

                <label className="activities-field">
                  <span>Duracao fixa</span>
                  <input
                    className={`input ${validationErrors.fixed_duration ? "activities-input--error" : ""}`}
                    type="number"
                    placeholder="Opcional"
                    value={newActivity.fixed_duration}
                    onChange={e =>
                      setNewActivity({
                        ...newActivity,
                        fixed_duration: e.target.value === "" ? "" : parseIntegerOrFallback(e.target.value, "")
                      })
                    }
                  />
                  {validationErrors.fixed_duration && <span className="activities-error">{validationErrors.fixed_duration}</span>}
                </label>
              </div>
            )}

            {usesNeutralCategory ? (
              <div className="activities-group">
                <span className="activities-group__label">Categoria</span>
                <p className="activities-helper">
                  Atividades todo dia, intercaladas e com horario fixo ficam fora do calculo de pesos e nao usam Disciplina ou Diversao.
                </p>
              </div>
            ) : (
              <>
                <div className="activities-group">
                  <span className="activities-group__label">Categoria</span>
                  <div className="activities-chip-grid activities-chip-grid--compact">
                    <button
                      type="button"
                      className={`activities-flag ${newActivity.is_disc ? "active" : ""}`}
                      onClick={() => setNewActivity({ ...newActivity, is_disc: !newActivity.is_disc })}
                    >
                      Disciplina
                    </button>
                    <button
                      type="button"
                      className={`activities-flag ${newActivity.is_fun ? "active" : ""}`}
                      onClick={() => setNewActivity({ ...newActivity, is_fun: !newActivity.is_fun })}
                    >
                      Diversao
                    </button>
                  </div>
                </div>

                {validationErrors.category && <span className="activities-error">{validationErrors.category}</span>}
              </>
            )}

            <div className="activities-form__actions">
              <button className="btn btn-primary" onClick={onCreateActivity}>
                {editingActivityId ? "Salvar alteracoes" : "Criar atividade"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {state.status === "error" && <div className="daily-status daily-status--error">{state.error}</div>}
      {state.status === "success" && state.successMessage && <div className="daily-status daily-status--success">{state.successMessage}</div>}

      <div className="daily-modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
      </div>
    </AccessibleModal>
  );
}
