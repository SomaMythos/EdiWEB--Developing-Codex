import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

const DEFAULT_TUNING = ["E", "B", "G", "D", "A", "E"];
const DEFAULT_STRING_MIDI = [64, 59, 55, 50, 45, 40];
const TUNING_NOTE_OPTIONS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_OFFSETS = {
  c: 0,
  "c#": 1,
  db: 1,
  d: 2,
  "d#": 3,
  eb: 3,
  e: 4,
  f: 5,
  "f#": 6,
  gb: 6,
  g: 7,
  "g#": 8,
  ab: 8,
  a: 9,
  "a#": 10,
  bb: 10,
  b: 11,
};
const SUBDIVISION_OPTIONS = [
  { value: 1, label: "1/4" },
  { value: 2, label: "1/8" },
  { value: 4, label: "1/16" },
  { value: 8, label: "1/32" },
];

const normalizeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const formatLoopLabel = (start, end) => `Loop ${start}-${end}`;

const sanitizeTuningName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-g#b]/g, "");

const tuningToMidi = (tuningValue, rowIndex) => {
  const normalized = sanitizeTuningName(tuningValue);
  if (!normalized || typeof NOTE_OFFSETS[normalized] === "undefined") {
    return DEFAULT_STRING_MIDI[rowIndex] ?? DEFAULT_STRING_MIDI[DEFAULT_STRING_MIDI.length - 1];
  }

  const defaultMidi = DEFAULT_STRING_MIDI[rowIndex] ?? DEFAULT_STRING_MIDI[DEFAULT_STRING_MIDI.length - 1];
  const baseOctave = Math.floor(defaultMidi / 12) - 1;
  let midi = (baseOctave + 1) * 12 + NOTE_OFFSETS[normalized];

  while (midi - defaultMidi > 6) {
    midi -= 12;
  }
  while (defaultMidi - midi > 6) {
    midi += 12;
  }

  return midi;
};

const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const parseFretValue = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const clampLoopValue = (value, max) => Math.max(1, Math.min(max, value));

export default function TrainingPracticeModal({ training, onClose, onRecorded }) {
  const audioCtxRef = useRef(null);
  const gridShellRef = useRef(null);
  const columnRefs = useRef([]);

  const initialTuning = Array.isArray(training?.tuning) && training.tuning.length === 6
    ? training.tuning.map((item) => String(item || "").trim().toUpperCase())
    : DEFAULT_TUNING;
  const rawCells = Array.isArray(training?.exercise_data?.cells) ? training.exercise_data.cells : [];
  const columns = normalizeNumber(training?.exercise_data?.columns, 8);
  const measureSize = normalizeNumber(training?.exercise_data?.measure_size, 4);
  const cells = Array.from({ length: 6 }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => rawCells?.[rowIndex]?.[columnIndex] ?? "")
  );
  const noteText = training?.exercise_data?.notes || "";
  const initialSpeed = normalizeNumber(training?.last_bpm || training?.target_bpm, 80);

  const [liveTuning, setLiveTuning] = useState(initialTuning);
  const [startBpm, setStartBpm] = useState(String(initialSpeed));
  const [endBpm, setEndBpm] = useState(String(Math.max(initialSpeed, normalizeNumber(training?.target_bpm, initialSpeed))));
  const [currentBpm, setCurrentBpm] = useState(initialSpeed);
  const [loopIncreasePercent, setLoopIncreasePercent] = useState("5");
  const [subdivision, setSubdivision] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentColumn, setCurrentColumn] = useState(0);
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(columns);
  const [completedLoops, setCompletedLoops] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const stringMidis = useMemo(
    () => liveTuning.map((item, rowIndex) => tuningToMidi(item, rowIndex)),
    [liveTuning]
  );

  const loopRange = useMemo(
    () => ({
      start: clampLoopValue(loopStart, columns),
      end: clampLoopValue(loopEnd, columns),
    }),
    [columns, loopEnd, loopStart]
  );

  const stepMs = useMemo(
    () => Math.max(80, Math.round((60000 / Math.max(1, Number(currentBpm) || 80)) / subdivision)),
    [currentBpm, subdivision]
  );

  const ensureAudioContext = async () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      audioCtxRef.current = new AudioContextClass();
    }

    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  };

  const playColumnNotes = async (columnIndex) => {
    if (!soundEnabled || columnIndex < 0 || columnIndex >= columns) {
      return;
    }

    const ctx = await ensureAudioContext();
    if (!ctx) {
      return;
    }

    const notes = cells
      .map((row, rowIndex) => {
        const fret = parseFretValue(row?.[columnIndex]);
        if (fret === null) {
          return null;
        }
        return midiToFrequency(stringMidis[rowIndex] + fret);
      })
      .filter(Boolean);

    if (notes.length === 0) {
      return;
    }

    const now = ctx.currentTime;
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.value = frequency;

      filter.type = "lowpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.7;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.04, 0.14 / notes.length), now + 0.008 + index * 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.24, stepMs / 1000));

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.002);
      osc.stop(now + Math.min(0.28, stepMs / 1000 + 0.04));
    });
  };

  const resetTrainer = () => {
    const normalizedStart = normalizeNumber(startBpm, initialSpeed);
    setIsPlaying(false);
    setCurrentBpm(normalizedStart);
    setCompletedLoops(0);
    setCurrentColumn(loopRange.start - 1);
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    setCurrentColumn(loopRange.start - 1);
  }, [loopRange.start]);

  useEffect(() => {
    if (loopRange.end < loopRange.start) {
      setLoopEnd(loopRange.start);
    }
  }, [loopRange.end, loopRange.start]);

  useEffect(() => {
    if (!isPlaying) {
      const normalizedStart = normalizeNumber(startBpm, initialSpeed);
      setCurrentBpm(normalizedStart);
      setCompletedLoops(0);
    }
  }, [isPlaying, startBpm, initialSpeed]);

  useEffect(() => {
    setEndBpm((previous) => {
      const normalizedStart = normalizeNumber(startBpm, initialSpeed);
      const normalizedPrevious = normalizeNumber(previous, normalizedStart);
      return String(Math.max(normalizedPrevious, normalizedStart));
    });
  }, [startBpm, initialSpeed]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timerId = window.setInterval(() => {
      setCurrentColumn((previous) => {
        const startIndex = loopRange.start - 1;
        const endIndex = loopRange.end - 1;

        if (previous < startIndex || previous >= endIndex) {
          setCompletedLoops((current) => {
            const nextLoop = current + 1;
            setCurrentBpm((currentBpmValue) => {
              const normalizedStart = normalizeNumber(startBpm, initialSpeed);
              const normalizedEnd = Math.max(normalizedStart, normalizeNumber(endBpm, normalizedStart));
              const normalizedLoopIncrease = normalizeNonNegativeNumber(loopIncreasePercent, 0);
              const nextBpm = normalizedLoopIncrease <= 0 || currentBpmValue >= normalizedEnd
                ? Math.min(currentBpmValue, normalizedEnd)
                : Math.min(normalizedEnd, Math.max(normalizedStart, Number((currentBpmValue * (1 + normalizedLoopIncrease / 100)).toFixed(2))));
              return nextBpm;
            });
            return nextLoop;
          });
          return startIndex;
        }

        return previous + 1;
      });
    }, stepMs);

    return () => window.clearInterval(timerId);
  }, [endBpm, initialSpeed, isPlaying, loopIncreasePercent, loopRange.end, loopRange.start, startBpm, stepMs]);

  useEffect(() => {
    const activeColumn = columnRefs.current[currentColumn];
    if (!activeColumn || !gridShellRef.current) {
      return;
    }

    activeColumn.scrollIntoView({
      behavior: isPlaying ? "smooth" : "auto",
      inline: "center",
      block: "nearest",
    });
  }, [currentColumn, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    playColumnNotes(currentColumn);
  }, [currentColumn, currentBpm, isPlaying, soundEnabled, stringMidis]);

  const handleRegisterSession = async () => {
    try {
      setSaving(true);
      setFeedback("");
      await api.post(`/music/training/${training.id}/session`, { bpm: Number(currentBpm) });
      setFeedback("Sessão registrada no histórico.");
      await onRecorded?.();
    } catch (error) {
      console.error("Erro ao registrar sessão de prática:", error);
      setFeedback("Não foi possível registrar a sessão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container training-practice-modal">
        <div className="training-practice-header">
          <div>
            <h3>{training?.name || "Prática"}</h3>
            <p>
              {training?.exercise_data?.library_group || "Biblioteca livre"}
              {training?.target_bpm ? ` | alvo ${training.target_bpm} BPM` : ""}
              {` | ${formatLoopLabel(loopRange.start, loopRange.end)}`}
            </p>
          </div>

          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="training-practice-toolbar">
          <label className="training-practice-control">
            <span>BPM inicial</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={startBpm}
              onChange={(event) => setStartBpm(event.target.value)}
              onBlur={() => setStartBpm(String(Math.min(400, Math.max(1, normalizeNumber(startBpm, initialSpeed)))))}
            />
          </label>

          <label className="training-practice-control">
            <span>BPM final</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={endBpm}
              onChange={(event) => setEndBpm(event.target.value)}
              onBlur={() => {
                const normalizedStart = normalizeNumber(startBpm, initialSpeed);
                setEndBpm(String(Math.min(400, Math.max(normalizedStart, normalizeNumber(endBpm, normalizedStart)))));
              }}
            />
          </label>

          <label className="training-practice-control">
            <span>Aumento por loop (%)</span>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              value={loopIncreasePercent}
              onChange={(event) => setLoopIncreasePercent(event.target.value)}
              onBlur={() => setLoopIncreasePercent(String(Math.min(100, normalizeNonNegativeNumber(loopIncreasePercent, 0))))}
            />
          </label>

          <label className="training-practice-control">
            <span>Subdivisão</span>
            <select
              className="input"
              value={subdivision}
              onChange={(event) => setSubdivision(normalizeNumber(event.target.value, 1))}
            >
              {SUBDIVISION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="training-practice-actions">
            <button
              type="button"
              className={`btn ${isPlaying ? "btn-secondary" : "btn-primary"}`}
              onClick={async () => {
                if (!isPlaying) {
                  const normalizedStart = normalizeNumber(startBpm, initialSpeed);
                  await ensureAudioContext();
                  setCurrentBpm(normalizedStart);
                  setCompletedLoops(0);
                  setCurrentColumn(loopRange.start - 1);
                }
                setIsPlaying((previous) => !previous);
              }}
            >
              {isPlaying ? "Pausar" : "Iniciar cursor"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetTrainer}
            >
              Resetar
            </button>
            <button
              type="button"
              className={soundEnabled ? "btn btn-secondary" : "btn btn-ghost"}
              onClick={() => setSoundEnabled((previous) => !previous)}
            >
              {soundEnabled ? "Som ligado" : "Som desligado"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRegisterSession}
              disabled={saving}
            >
              {saving ? "Registrando..." : "Registrar sessão"}
            </button>
          </div>
        </div>

        <div className="training-practice-loopbar">
          <label className="training-practice-control">
            <span>Início do loop</span>
            <select
              className="input"
              value={loopStart}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setLoopStart(nextValue);
                if (loopEnd < nextValue) {
                  setLoopEnd(nextValue);
                }
              }}
            >
              {Array.from({ length: columns }, (_, index) => index + 1).map((value) => (
                <option key={`loop-start-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="training-practice-control">
            <span>Fim do loop</span>
            <select
              className="input"
              value={loopEnd}
              onChange={(event) => setLoopEnd(Number(event.target.value))}
            >
              {Array.from({ length: columns }, (_, index) => index + 1)
                .filter((value) => value >= loopStart)
                .map((value) => (
                  <option key={`loop-end-${value}`} value={value}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="training-practice-status">
          <span>{currentBpm} BPM atual</span>
          <span>{normalizeNumber(startBpm, initialSpeed)} → {Math.max(normalizeNumber(startBpm, initialSpeed), normalizeNumber(endBpm, initialSpeed))} BPM</span>
          <span>{normalizeNonNegativeNumber(loopIncreasePercent, 0)}% por loop</span>
          <span>{completedLoops} loop(s)</span>
          <span>{SUBDIVISION_OPTIONS.find((option) => option.value === subdivision)?.label || "1/4"}</span>
          <span>{stepMs} ms por passo</span>
          <span>{soundEnabled ? "Playback ativo" : "Playback mutado"}</span>
        </div>

        <div className="training-practice-current-loop-box">
          <span>Loop atual</span>
          <strong>Loop {completedLoops} · {currentBpm} BPM</strong>
        </div>

        <div className="training-practice-tuning-bar">
          {liveTuning.map((stringName, rowIndex) => (
            <label key={`practice-tuning-${rowIndex}`} className="training-practice-tuning-control">
              <span>{rowIndex + 1}ª corda</span>
              <select
                className="input training-practice-tuning-input"
                value={stringName}
                onChange={(event) =>
                  setLiveTuning((previous) =>
                    previous.map((item, itemIndex) => (itemIndex === rowIndex ? event.target.value : item))
                  )
                }
              >
                {TUNING_NOTE_OPTIONS.map((note) => (
                  <option key={`${rowIndex}-${note}`} value={note}>
                    {note}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="training-practice-grid-shell" ref={gridShellRef}>
          <div className="training-practice-grid" style={{ ["--practice-columns"]: columns }}>
            {cells.map((row, rowIndex) => (
              <div key={`practice-row-${rowIndex}`} className="training-practice-row">
                <span className="training-practice-string">{liveTuning[rowIndex]}</span>
                <div className="training-practice-line">
                  {row.map((cell, columnIndex) => {
                    const displayIndex = columnIndex + 1;
                    const isLoopEdge = displayIndex === loopRange.start || displayIndex === loopRange.end;
                    const isActive = currentColumn === columnIndex;
                    return (
                      <span
                        key={`practice-cell-${rowIndex}-${columnIndex}`}
                        ref={rowIndex === 0 ? (element) => { columnRefs.current[columnIndex] = element; } : undefined}
                        className={[
                          "training-practice-slot",
                          columnIndex % measureSize === 0 ? "is-measure-start" : "",
                          isLoopEdge ? "is-loop-edge" : "",
                          isActive ? "is-active" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <span className={`training-practice-fret ${cell ? "has-value" : ""}`}>{cell || "\u00A0"}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="training-practice-footer">
          {noteText ? <p className="training-practice-note">{noteText}</p> : <p className="training-practice-note">Sem observações neste exercício.</p>}
          {feedback ? <span className="training-practice-feedback">{feedback}</span> : null}
        </div>
      </div>
    </div>
  );
}
