import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000/api";

// Fonte única de verdade para configuração diária.
export default function Daily() {
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [dayType, setDayType] = useState("work");
  const [blocks, setBlocks] = useState([]);
  const [summary, setSummary] = useState({
    total_blocks: 0,
    completed_blocks: 0,
    percentage: 0
  });

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState(null);

const [showConfig, setShowConfig] = useState(false);
const [config, setConfig] = useState(null);

const [showRoutineModal, setShowRoutineModal] = useState(false);
const [activeRoutine, setActiveRoutine] = useState(null);
const [routineBlocks, setRoutineBlocks] = useState([]);
const [newBlock, setNewBlock] = useState({
  name: "",
  start_time: "",
  end_time: "",
  category: "fixed"
});

// ==========================
// ACTIVITIES MODAL STATE
// ==========================

const [showActivitiesModal, setShowActivitiesModal] = useState(false);
const [activities, setActivities] = useState([]);

const [newActivity, setNewActivity] = useState({
  title: "",
  min_duration: 30,
  max_duration: 60,
  frequency_type: "flex", // flex | everyday | workday | offday
  fixed_time: "",
  fixed_duration: 30,
  is_disc: true,
  is_fun: false
});

function getFrequencyLabel(frequencyType) {
  const labels = {
    flex: "Flexível",
    everyday: "Todo Dia",
    workday: "Work Day",
    offday: "Off Day"
  };

  return labels[frequencyType] || "Flexível";
}

function formatFixedTime(timeValue) {
  if (!timeValue) return null;
  return String(timeValue).slice(0, 5);
}

function handleFrequencyChange(frequencyType) {
  setNewActivity(prev => {
    if (frequencyType === "flex") {
      return {
        ...prev,
        frequency_type: "flex",
        fixed_time: "",
        fixed_duration: 30
      };
    }

    return {
      ...prev,
      frequency_type: frequencyType
    };
  });
}



  useEffect(() => {
    fetchDaily(selectedDate);
    fetchDayType(selectedDate);
    fetchSummary(selectedDate);
  }, [selectedDate]);

  async function fetchDaily(date) {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/daily/${date}`);
      if (res.data.success) {
        setBlocks(res.data.data);
      }
    } catch {
      setBlocks([]);
    }
    setLoading(false);
  }

  async function fetchSummary(date) {
    try {
      const res = await axios.get(`${API_URL}/daily/summary`, {
        params: { date }
      });

      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch {
      setSummary({
        total_blocks: 0,
        completed_blocks: 0,
        percentage: 0
      });
    }
  }

  async function fetchDayType(date) {
    try {
      const res = await axios.get(`${API_URL}/daily/type`, {
        params: { date }
      });
      if (res.data.success) {
        setDayType(res.data.data.type);
      }
    } catch {
      setDayType("work");
    }
  }

async function fetchConfig() {
  const res = await runUiRequest(
    () => axios.get(`${API_URL}/day-config`),
    "Não foi possível carregar as configurações do dia."
  );

  if (res?.data?.success) {
    setConfig(res.data.data);
    return true;
  }

  return false;
}

async function fetchActiveRoutine(date) {
  const res = await runUiRequest(
    () => axios.get(`${API_URL}/daily/routine`, { params: { date } }),
    "Não foi possível carregar a rotina deste dia."
  );

  if (!res) {
    setActiveRoutine(null);
    setRoutineBlocks([]);
    return false;
  }

  console.log("Routine fetch response:", res.data);

  if (res.data.success && res.data.data) {
    setActiveRoutine(res.data.data.routine);
    setRoutineBlocks(res.data.data.blocks || []);
  } else {
    setActiveRoutine(null);
    setRoutineBlocks([]);
  }

  return true;
}

async function fetchActivities() {
  const res = await runUiRequest(
    () => axios.get(`${API_URL}/activities`),
    "Não foi possível carregar as atividades."
  );

  if (res?.data?.success) {
    setActivities(res.data.data);
    return true;
  }

  return false;
}

// activity types removido




  async function saveConfig() {
    const res = await runUiRequest(
      () => axios.post(`${API_URL}/day-config`, {
        sleep_start: config.sleep_start,
        sleep_end: config.sleep_end,
        work_start: config.work_start,
        work_end: config.work_end,
        buffer_between: parseIntegerOrFallback(config.buffer_between, 0),
        granularity_min: parseIntegerOrFallback(config.granularity_min, 1),
        avoid_category_adjacent: config.avoid_category_adjacent ? true : false,
        discipline_weight: parseIntegerOrFallback(config.discipline_weight, 1),
        fun_weight: parseIntegerOrFallback(config.fun_weight, 1)
      }),
      "Não foi possível salvar a configuração do dia."
    );

    if (!res) return;

    setShowConfig(false);
  }

  async function toggleDayType() {
    const isOff = dayType === "work";

    const res = await runUiRequest(
      () => axios.post(`${API_URL}/daily/override`, {
        date: selectedDate,
        is_off: isOff
      }),
      "Não foi possível alternar o tipo de dia."
    );

    if (!res) return;

    await fetchDayType(selectedDate);
    await fetchDaily(selectedDate);
    await fetchSummary(selectedDate);
  }

  async function generateDaily() {
    setGenerating(true);

    try {
      const res = await runUiRequest(
        () => axios.post(`${API_URL}/daily/generate`, null, {
          params: { date: selectedDate }
        }),
        "Não foi possível gerar o planejamento do dia."
      );

      if (!res) return;

      await fetchDaily(selectedDate);
      await fetchSummary(selectedDate);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleCompletion(blockId, currentState) {
    const nextState = !Boolean(currentState);

    const res = await runUiRequest(
      () => axios.patch(`${API_URL}/daily/block/${blockId}/complete`, { completed: nextState }),
      "Não foi possível atualizar o status do bloco."
    );

    if (!res) return;

    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? { ...b, completed: nextState }
          : b
      )
    );

    await fetchSummary(selectedDate);
  }

  function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function addMinutesToTime(start, minutes) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseIntegerOrFallback(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isBlockCompleted(value) {
  return value === true || value === 1;
}

function showError(message) {
  setFeedback({ type: "error", message });
}

function clearFeedback() {
  setFeedback(null);
}

async function runUiRequest(requestFn, friendlyMessage) {
  try {
    return await requestFn();
  } catch (err) {
    console.error(err);
    showError(friendlyMessage);
    return null;
  }
}


  
  

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={styles.title}>Agenda do Dia</h2>

          <div
            style={{
              ...styles.dayBadge,
              background:
                dayType === "work"
                  ? "linear-gradient(135deg,#1976d2,#0d47a1)"
                  : "linear-gradient(135deg,#9c27b0,#4a148c)"
            }}
          >
            {dayType === "work" ? "WORK DAY" : "OFF DAY"}
          </div>

          {/* PROGRESS */}
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.progressBar,
                width: `${summary.percentage}%`
              }}
            />
          </div>

          <div style={styles.progressText}>
            {summary.completed_blocks}/{summary.total_blocks} concluídos
          </div>

          {/* ESTATÍSTICAS */}
          {blocks.length > 0 && (
            <div style={styles.summaryCard}>
              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Total Planejado</div>
                <div style={styles.summaryValue}>
                  {formatDuration(
                    blocks.reduce((sum, b) => sum + b.duration, 0)
                  )}
                </div>
              </div>

              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Concluído</div>
                <div style={styles.summaryValue}>
                  {formatDuration(
                    blocks
                      .filter(b => isBlockCompleted(b.completed))
                      .reduce((sum, b) => sum + b.duration, 0)
                  )}
                </div>
              </div>

              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Progresso</div>
                <div style={styles.summaryValue}>
                  {summary.percentage}%
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.controls}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={styles.dateInput}
          />

          <button
            onClick={generateDaily}
            style={styles.primaryButton}
            disabled={generating}
          >
            {generating ? "Gerando..." : "Gerar Dia"}
          </button>

          <button
            onClick={toggleDayType}
            style={styles.secondaryButton}
          >
            Alternar Dia
          </button>

          <button
  onClick={async () => {
    const loaded = await fetchConfig();
    if (loaded) {
      clearFeedback();
      setShowConfig(true);
    }
  }}
  style={styles.secondaryButton}
>
  ⚙ Configurar Dia
</button>

<button
  onClick={async () => {
    const loaded = await fetchActiveRoutine(selectedDate);
    if (loaded) {
      clearFeedback();
      setShowRoutineModal(true);
    }
  }}
  style={styles.secondaryButton}
>
  🧩 Rotinas
</button>
<button
  onClick={async () => {
    const loaded = await fetchActivities();
    if (loaded) {
      clearFeedback();
      setShowActivitiesModal(true);
    }
  }}
  style={styles.secondaryButton}
>
  📚 Activities
</button>

        </div>
      </div>

      {feedback && (
        <div style={styles.feedbackBanner}>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={clearFeedback}
            style={styles.feedbackCloseButton}
          >
            ✕
          </button>
        </div>
      )}

      {/* MODAL */}
      {showConfig && config && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Configuração do Dia</h3>

            {[
              ["Sono Início", "sleep_start"],
              ["Sono Fim", "sleep_end"],
              ["Work Início", "work_start"],
              ["Work Fim", "work_end"]
            ].map(([label, key]) => (
              <div key={key} style={styles.formRow}>
                <label>{label}</label>
                <input
                  type="time"
                  value={config[key]}
                  onChange={e =>
                    setConfig({
                      ...config,
                      [key]: e.target.value
                    })
                  }
                />
              </div>
            ))}

            <div style={styles.formRow}>
              <label>Buffer (min)</label>
              <input
                type="number"
                value={config.buffer_between}
                onChange={e =>
                  setConfig({
                    ...config,
                    buffer_between: parseIntegerOrFallback(e.target.value, 0)
                  })
                }
              />
            </div>

<div style={styles.formRow}>
  <label>Peso Disciplina</label>
  <input
    type="number"
    value={config.discipline_weight}
    onChange={e =>
      setConfig({
        ...config,
        discipline_weight: parseIntegerOrFallback(e.target.value, 1)
      })
    }
  />
</div>

<div style={styles.formRow}>
  <label>Peso Diversão</label>
  <input
    type="number"
    value={config.fun_weight}
    onChange={e =>
      setConfig({
        ...config,
        fun_weight: parseIntegerOrFallback(e.target.value, 1)
      })
    }
  />
</div>


            <div style={styles.formRow}>
              <label>
                <input
                  type="checkbox"
                  checked={
                    config.avoid_category_adjacent === 1 ||
                    config.avoid_category_adjacent === true
                  }
                  onChange={e =>
                    setConfig({
                      ...config,
                      avoid_category_adjacent: e.target.checked
                    })
                  }
                />
                Evitar categorias adjacentes
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                style={styles.secondaryButton}
                onClick={() => setShowConfig(false)}
              >
                Cancelar
              </button>

              <button
                style={styles.primaryButton}
                onClick={saveConfig}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

{/* ROTINE MODAL */}
{showRoutineModal && (
  <div style={styles.modalOverlay}>
    <div style={{ ...styles.modal, width: "500px" }}>
      <h3>Rotina ({dayType})</h3>

      {!activeRoutine && (
  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
    <div style={{ opacity: 0.6 }}>
      Nenhuma rotina configurada para este tipo de dia.
    </div>

    <button
  style={styles.primaryButton}
  onClick={async () => {
    console.log("Criando rotina para:", dayType);

    const res = await runUiRequest(
      () => axios.post(`${API_URL}/daily/routines`, {
        name: `Rotina ${dayType === "work" ? "Work" : "Off"}`,
        day_type: dayType
      }),
      "Não foi possível criar uma rotina para este tipo de dia."
    );

    if (!res) return;

    console.log("Resposta backend:", res.data);

    await fetchActiveRoutine(selectedDate);
  }}
>
  Criar rotina {dayType === "work" ? "Work" : "Off"}
</button>

  </div>
)}

      {routineBlocks.map(block => (
        <div
          key={block.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid #2a2a35"
          }}
        >
          <div>
            <strong>{block.name}</strong>
            <div style={{ fontSize: "12px", opacity: 0.6 }}>
              {block.start_time} - {block.end_time}
            </div>
          </div>

          <button
            style={styles.secondaryButton}
            onClick={async () => {
              const res = await runUiRequest(
                () => axios.delete(`${API_URL}/daily/routines/blocks/${block.id}`),
                "Não foi possível remover o bloco da rotina."
              );

              if (!res) return;

              await fetchActiveRoutine(selectedDate);
            }}
          >
            Remover
          </button>
        </div>
      ))}

      {activeRoutine && (
        <>
          <h4 style={{ marginTop: "20px" }}>Novo Bloco</h4>

          <div style={styles.formRow}>
            <input
              placeholder="Nome"
              value={newBlock.name}
              onChange={e =>
                setNewBlock({ ...newBlock, name: e.target.value })
              }
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="time"
              value={newBlock.start_time}
              onChange={e =>
                setNewBlock({ ...newBlock, start_time: e.target.value })
              }
            />

            <input
              type="time"
              value={newBlock.end_time}
              onChange={e =>
                setNewBlock({ ...newBlock, end_time: e.target.value })
              }
            />
          </div>

          <button
            style={{ ...styles.primaryButton, marginTop: "10px" }}
            onClick={async () => {
              const blockName = newBlock.name.trim();
              if (!blockName) {
                showError("Nome do bloco é obrigatório.");
                return;
              }

              if (!newBlock.start_time || !newBlock.end_time) {
                showError("Preencha os horários de início e fim.");
                return;
              }

              if (newBlock.start_time === newBlock.end_time) {
                showError("Horário de fim deve ser diferente do início.");
                return;
              }

              const res = await runUiRequest(
                () => axios.post(`${API_URL}/daily/routines/blocks`, {
                  routine_id: activeRoutine.id,
                  ...newBlock,
                  name: blockName
                }),
                "Não foi possível adicionar o bloco na rotina."
              );

              if (!res) return;

              setNewBlock({
                name: "",
                start_time: "",
                end_time: "",
                category: "fixed"
              });

              await fetchActiveRoutine(selectedDate);
            }}
          >
            Adicionar
          </button>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
        <button
          style={styles.secondaryButton}
          onClick={() => setShowRoutineModal(false)}
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
)}

{/* ACTIVITIES MODAL */}
{showActivitiesModal && (
  <div style={styles.scrollableModalOverlay}>
    <div
      style={{
        ...styles.modal,
        width: "650px",
        maxHeight: "calc(100vh - 48px)",
        overflowY: "auto",
        alignItems: "center",
        textAlign: "center"
      }}
    >
      <h3 style={{ marginBottom: 10 }}>Atividades</h3>


      <div style={{ marginBottom: 10 }} />



      {/* ========================= */}
      {/* ACTIVITIES TAB */}
      {/* ========================= */}
      <div style={{ width: "100%", maxWidth: 500 }}>

          {activities.map(a => (
            <div
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #2a2a35"
              }}
            >
              <div>
                <strong>{a.title}</strong>
<div style={{ fontSize: 12, opacity: 0.6 }}>
  {a.min_duration === a.max_duration
    ? `${a.min_duration} min`
    : `${a.min_duration} - ${a.max_duration} min`}
</div>
<div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
  {getFrequencyLabel(a.frequency_type)}
  {a.frequency_type !== "flex" && formatFixedTime(a.fixed_time)
    ? ` • Horário fixo ${formatFixedTime(a.fixed_time)}`
    : ""}
  {a.frequency_type !== "flex" && a.fixed_duration
    ? ` • Duração fixa ${a.fixed_duration} min`
    : ""}
  {a.is_disc ? " • Disciplina" : ""}
  {a.is_fun ? " • Diversão" : ""}
</div>

              </div>

<div style={{ display: "flex", gap: 8 }}>
  <button
    style={styles.secondaryButton}
    onClick={async () => {
      const res = await runUiRequest(
        () => axios.patch(`${API_URL}/activities/${a.id}/toggle`),
        "Não foi possível alterar o status da atividade."
      );

      if (!res) return;

      await fetchActivities();
    }}
  >
    {a.active ? "Desativar" : "Ativar"}
  </button>

  <button
    style={{
      ...styles.secondaryButton,
      background: "#3a1f1f",
      border: "1px solid #5a2a2a"
    }}
    onClick={async () => {
      if (!window.confirm("Excluir atividade permanentemente?")) return;

      const res = await runUiRequest(
        () => axios.delete(`${API_URL}/activities/${a.id}`),
        "Não foi possível excluir a atividade."
      );

      if (!res) return;

      await fetchActivities();
    }}
  >
    Excluir
  </button>
</div>

            </div>
          ))}

          <h4 style={{ marginTop: 30, marginBottom: 15 }}>
            Nova Atividade
          </h4>

<div style={{ display: "flex", flexDirection: "column", gap: 15 }}>

<input
  style={{
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #2a2a35",
    background: "#14141b",
    color: "#fff"
  }}
  placeholder="Título"
  value={newActivity.title}
  onChange={e =>
    setNewActivity({ ...newActivity, title: e.target.value })
  }
/>

<div style={{ display: "flex", gap: 10 }}>
  <input
    style={{
      flex: 1,
      padding: "8px",
      borderRadius: "6px",
      border: "1px solid #2a2a35",
      background: "#14141b",
      color: "#fff"
    }}
    type="number"
    placeholder="Mín (min)"
    value={newActivity.min_duration}
    onChange={e =>
      setNewActivity({
        ...newActivity,
        min_duration: parseInt(e.target.value)
      })
    }
  />

  <input
    style={{
      flex: 1,
      padding: "8px",
      borderRadius: "6px",
      border: "1px solid #2a2a35",
      background: "#14141b",
      color: "#fff"
    }}
    type="number"
    placeholder="Máx (min)"
    value={newActivity.max_duration}
    onChange={e =>
      setNewActivity({
        ...newActivity,
        max_duration: parseInt(e.target.value)
      })
    }
  />
</div>

<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>



  <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>

  <label>
    <input
      type="radio"
      name="frequency"
      checked={newActivity.frequency_type === "flex"}
      onChange={() => handleFrequencyChange("flex")}
    />
    Flexível
  </label>

  <label>
    <input
      type="radio"
      name="frequency"
      checked={newActivity.frequency_type === "everyday"}
      onChange={() => handleFrequencyChange("everyday")}
    />
    Todo Dia
  </label>

  <label>
    <input
      type="radio"
      name="frequency"
      checked={newActivity.frequency_type === "workday"}
      onChange={() => handleFrequencyChange("workday")}
    />
    Work Day
  </label>

  <label>
    <input
      type="radio"
      name="frequency"
      checked={newActivity.frequency_type === "offday"}
      onChange={() => handleFrequencyChange("offday")}
    />
    Off Day
  </label>

</div>

{newActivity.frequency_type !== "flex" && (
  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
    <input
      type="time"
      value={newActivity.fixed_time}
      onChange={e =>
        setNewActivity({
          ...newActivity,
          fixed_time: e.target.value
        })
      }
      style={{
        width: "170px",
        padding: "8px",
        borderRadius: "6px",
        border: "1px solid #2a2a35",
        background: "#14141b",
        color: "#fff"
      }}
    />

    <input
      type="number"
      placeholder="Duração (min)"
      value={newActivity.fixed_duration}
      onChange={e =>
        setNewActivity({
          ...newActivity,
          fixed_duration: parseInt(e.target.value)
        })
      }
      style={{
        width: "170px",
        padding: "8px",
        borderRadius: "6px",
        border: "1px solid #2a2a35",
        background: "#14141b",
        color: "#fff"
      }}
    />
  </div>
)}

  <div style={{ display: "flex", justifyContent: "center", gap: 25, flexWrap: "wrap" }}>
  <label>
    <input
      type="checkbox"
      checked={newActivity.is_disc}
      onChange={e =>
        setNewActivity({
          ...newActivity,
          is_disc: e.target.checked,
          is_fun: false
        })
      }
    />
    Disciplina
  </label>

  <label>
    <input
      type="checkbox"
      checked={newActivity.is_fun}
      onChange={e =>
        setNewActivity({
          ...newActivity,
          is_fun: e.target.checked,
          is_disc: false
        })
      }
    />
    Diversão
  </label>
  </div>

</div>

</div>

<button

  style={{
    ...styles.primaryButton,
    marginTop: 20,
    alignSelf: "center",
    padding: "10px 30px"
  }}
  onClick={async () => {

    if (!newActivity.title) {
      showError("Preencha o título.");
      return;
    }

    const activityPayload = {
      ...newActivity,
      fixed_time:
        newActivity.frequency_type === "flex"
          ? null
          : (newActivity.fixed_time || null),
      fixed_duration:
        newActivity.frequency_type === "flex"
          ? null
          : newActivity.fixed_duration
    };

    const res = await runUiRequest(
      () => axios.post(`${API_URL}/activities`, activityPayload),
      "Não foi possível criar a atividade."
    );

    if (!res) return;

setNewActivity({
  title: "",
  min_duration: 30,
  max_duration: 60,
  frequency_type: "flex",
  fixed_time: "",
  fixed_duration: 30,
  is_disc: true,
  is_fun: false
});

    await fetchActivities();
  }}
>
  Criar
</button>

        </div>

      {/* ========================= */}
      {/* TYPES TAB */}
      {/* ========================= */}
      
	  
	  {/* Aba Types removida completamente */}


      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          style={styles.secondaryButton}
          onClick={() => setShowActivitiesModal(false)}
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
)}


{/* TIMELINE */}
      {loading ? (
        <div style={styles.loading}>Carregando...</div>
      ) : (
        <div style={styles.timeline}>
          {blocks.length === 0 && (
            <div style={styles.empty}>
              Nenhum plano gerado para este dia.
            </div>
          )}

 {blocks.map(block => {
  const endTime = addMinutesToTime(
    block.start_time,
    block.duration
  );

  return (
    <div
      key={block.id}
      style={{
        ...styles.block,
        background: block.completed
          ? "linear-gradient(135deg,#102d18,#0f1f16)"
          : "#1a1a22",
        borderColor: block.completed
          ? "#00c853"
          : "#2a2a35",
        opacity: block.completed ? 0.7 : 1
      }}
    >
      <div style={styles.left}>
        <input
          type="checkbox"
          checked={isBlockCompleted(block.completed)}
          onChange={() =>
            toggleCompletion(block.id, isBlockCompleted(block.completed))
          }
          style={styles.checkbox}
        />

        <div>
          <div style={styles.time}>
            {block.start_time} - {endTime}
          </div>
          <div style={styles.duration}>
            {formatDuration(block.duration)}
          </div>
        </div>
      </div>

      <div style={styles.activityName}>
        {block.activity_title || "Bloco fixo"}
      </div>
    </div>
  );
})}

        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "40px",
    color: "#fff",
    minHeight: "100vh",
    background: "#0f0f14"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "40px"
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 600
  },
  dayBadge: {
    marginTop: "8px",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block"
  },
  controls: {
    display: "flex",
    gap: "12px",
    alignItems: "center"
  },
  dateInput: {
    background: "#1a1a22",
    border: "1px solid #2a2a35",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "6px"
  },
  primaryButton: {
    background: "linear-gradient(135deg,#00c853,#009624)",
    border: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer"
  },
  secondaryButton: {
    background: "#1a1a22",
    border: "1px solid #2a2a35",
    padding: "8px 14px",
    borderRadius: "6px",
    color: "#ccc",
    cursor: "pointer"
  },
  progressContainer: {
    width: "220px",
    height: "6px",
    background: "#1a1a22",
    borderRadius: "6px",
    overflow: "hidden",
    marginTop: "6px"
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(135deg,#00c853,#009624)",
    transition: "width 0.3s ease"
  },
  progressText: {
    fontSize: "12px",
    opacity: 0.7,
    marginTop: "6px"
  },
  summaryCard: {
    display: "flex",
    gap: "40px",
    marginTop: "12px"
  },
  summaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  summaryLabel: {
    fontSize: "12px",
    opacity: 0.6
  },
  summaryValue: {
    fontSize: "16px",
    fontWeight: 600
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  scrollableModalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    overflowY: "auto",
    padding: "24px 16px",
    zIndex: 1000
  },
  modal: {
    background: "#1a1a22",
    padding: "30px",
    borderRadius: "12px",
    width: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },
  formRow: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginTop: "30px"
  },
  block: {
    padding: "16px",
    borderRadius: "10px",
    border: "1px solid",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  left: {
    display: "flex",
    gap: "14px",
    alignItems: "center"
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#00c853",
    cursor: "pointer"
  },
  time: {
    fontWeight: 600
  },
  duration: {
    fontSize: "13px",
    opacity: 0.7
  },
  activityName: {
    fontWeight: 500,
    opacity: 0.85
  },
  loading: {
    opacity: 0.7
  },
  empty: {
    opacity: 0.5,
    fontStyle: "italic"
  },
  feedbackBanner: {
    marginBottom: "20px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #5a2a2a",
    background: "#2a1212",
    color: "#ffbdbd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px"
  },
  feedbackCloseButton: {
    background: "transparent",
    border: "none",
    color: "#ffbdbd",
    cursor: "pointer",
    fontSize: "14px"
  }
};
