import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../../services/api";

const formatDateTime = (value) => {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TrainingHistoryModal({ training, onClose }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/music/training/${training.id}/history`);
        const formatted = res.data.data.map((item, index) => ({
          ...item,
          index: index + 1,
        }));
        setHistory(formatted);
      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
      }
    };

    if (training?.id) {
      fetchHistory();
    }
  }, [training?.id]);

  const latestSessions = useMemo(() => [...history].reverse().slice(0, 6), [history]);

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container history-modal training-history-modal">
        <div className="training-history-header">
          <div>
            <h3>Histórico de treino</h3>
            <p>{training?.name || "Treino"}</p>
          </div>

          <button className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="training-history-summary">
          <div className="training-history-stat">
            <span>Sessões</span>
            <strong>{training?.session_count || 0}</strong>
          </div>
          <div className="training-history-stat">
            <span>Melhor BPM</span>
            <strong>{training?.best_bpm || "--"}</strong>
          </div>
          <div className="training-history-stat">
            <span>Média</span>
            <strong>{training?.average_bpm || "--"}</strong>
          </div>
          <div className="training-history-stat">
            <span>Última prática</span>
            <strong>{formatDateTime(training?.last_practiced_at)}</strong>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="app-state-card app-state-card--inline">
            <p className="app-state-card__title">Nenhum registro ainda</p>
            <p className="app-state-card__text">Quando você registrar sessões de BPM, o gráfico e a linha do tempo aparecem aqui.</p>
          </div>
        ) : (
          <>
            <div className="history-chart">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="index" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="bpm"
                    stroke="#facc15"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="training-history-log">
              {latestSessions.map((entry) => (
                <div key={`${entry.index}-${entry.created_at}`} className="training-history-log-item">
                  <strong>{entry.bpm} BPM</strong>
                  <span>{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
