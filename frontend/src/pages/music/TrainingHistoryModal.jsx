import { useEffect, useState } from "react";
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

export default function TrainingHistoryModal({ trainingId, onClose }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/music/training/${trainingId}/history`);
        const formatted = res.data.data.map((item, index) => ({
          ...item,
          index: index + 1,
        }));
        setHistory(formatted);
      } catch (err) {
        console.error("Erro ao buscar historico:", err);
      }
    };

    fetchHistory();
  }, [trainingId]);

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container history-modal">
        <h3>Historico de BPM</h3>

        {history.length === 0 ? (
          <p>Nenhum registro ainda.</p>
        ) : (
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
        )}

        <button className="btn btn-ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
