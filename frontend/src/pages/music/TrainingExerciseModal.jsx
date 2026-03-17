import { useMemo, useState } from "react";
import api from "../../services/api";

const DEFAULT_TUNING = ["e", "B", "G", "D", "A", "E"];
const DEFAULT_COLUMNS = 8;

const resizeCells = (cells, columns) =>
  Array.from({ length: 6 }, (_, rowIndex) => {
    const currentRow = Array.isArray(cells?.[rowIndex]) ? cells[rowIndex] : [];
    return Array.from({ length: columns }, (_, columnIndex) => currentRow[columnIndex] ?? "");
  });

export default function TrainingExerciseModal({ training, onClose, onSaved }) {
  const existingExercise = training?.exercise_data || null;
  const [name, setName] = useState(training?.name || "");
  const [targetBpm, setTargetBpm] = useState(training?.target_bpm || "");
  const [tuning, setTuning] = useState(training?.tuning?.length === 6 ? training.tuning : DEFAULT_TUNING);
  const [columns, setColumns] = useState(existingExercise?.columns || DEFAULT_COLUMNS);
  const [cells, setCells] = useState(resizeCells(existingExercise?.cells, existingExercise?.columns || DEFAULT_COLUMNS));
  const [notes, setNotes] = useState(existingExercise?.notes || "");
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => (training ? "Editar exercício" : "Novo exercício"), [training]);

  const handleColumnsChange = (nextColumns) => {
    const normalized = Math.max(4, Math.min(32, Number(nextColumns) || DEFAULT_COLUMNS));
    setColumns(normalized);
    setCells((previous) => resizeCells(previous, normalized));
  };

  const handleTuningChange = (index, value) => {
    setTuning((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? value.slice(0, 3) : item))
    );
  };

  const handleCellChange = (rowIndex, columnIndex, value) => {
    const normalized = value.slice(0, 3);
    setCells((previous) =>
      previous.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? normalized : cell))
          : row
      )
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      instrument: "guitar",
      target_bpm: targetBpm === "" ? null : Number(targetBpm),
      tuning: tuning.map((item) => item.trim() || "-"),
      columns,
      cells,
      notes: notes.trim() || null,
    };

    try {
      setSaving(true);
      let response;

      if (training?.id) {
        response = await api.put(`/music/training/${training.id}/exercise`, payload);
      } else {
        response = await api.post("/music/training/exercise", payload);
      }

      await onSaved?.(response?.data?.data ?? null);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar exercício:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container training-exercise-modal">
        <h3>{title}</h3>

        <form onSubmit={handleSubmit} className="modal-form training-exercise-form">
          <div className="training-exercise-topbar">
            <input
              className="input"
              placeholder="Nome do exercício"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

            <input
              className="input"
              type="number"
              min="1"
              max="400"
              placeholder="BPM alvo"
              value={targetBpm}
              onChange={(event) => setTargetBpm(event.target.value)}
            />

            <input
              className="input"
              type="number"
              min="4"
              max="32"
              value={columns}
              onChange={(event) => handleColumnsChange(event.target.value)}
            />
          </div>

          <div className="training-exercise-panel">
            <div className="training-exercise-heading">
              <strong>Tablatura</strong>
              <span>{columns} passos | compasso visual a cada 4</span>
            </div>

            <div className="training-exercise-grid-shell">
              <div className="training-exercise-grid" style={{ ["--exercise-columns"]: columns }}>
                {cells.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="training-exercise-row">
                    <input
                      className="training-exercise-tuning"
                      value={tuning[rowIndex]}
                      onChange={(event) => handleTuningChange(rowIndex, event.target.value)}
                      aria-label={`Afinação da corda ${rowIndex + 1}`}
                    />

                    <div className="training-exercise-line">
                      {row.map((cell, columnIndex) => (
                        <span
                          key={`cell-${rowIndex}-${columnIndex}`}
                          className={`training-exercise-slot ${columnIndex % 4 === 0 ? "is-measure-start" : ""}`}
                        >
                          <input
                            className="training-exercise-cell"
                            value={cell}
                            onChange={(event) => handleCellChange(rowIndex, columnIndex, event.target.value)}
                            aria-label={`Corda ${rowIndex + 1}, passo ${columnIndex + 1}`}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <textarea
            className="input training-exercise-notes"
            rows={4}
            placeholder="Observações do exercício, técnica, acentuação, palhetada, variação..."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando..." : training ? "Salvar exercício" : "Criar exercício"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
