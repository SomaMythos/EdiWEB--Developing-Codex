import { useState } from "react";
import api from "../../services/api";

export default function BpmModal({ trainingId, onClose, onSaved }) {
  const [bpm, setBpm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bpm) return;

    try {
      setLoading(true);
      await api.post(`/music/training/${trainingId}/session`, {
        bpm: Number(bpm),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao registrar BPM:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container">
        <h3>Registrar BPM</h3>

        <form onSubmit={handleSubmit} className="modal-form">
          <input
            type="number"
            className="input"
            placeholder="Ex: 140"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            min="1"
            required
          />

          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </form>

        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
