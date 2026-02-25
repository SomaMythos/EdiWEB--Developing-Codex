import { useState } from "react";
import axios from "axios";

export default function TrainingUploadModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [instrument, setInstrument] = useState("guitar");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("name", name);
    formData.append("instrument", instrument);
    formData.append("image", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:8000/api/music/training",
        formData
      );

      onCreated(res.data.data);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-strong modal-container">
        <h3>Novo Treino</h3>

        <form onSubmit={handleSubmit} className="modal-form">
          <input
            className="input"
            placeholder="Nome do treino"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <select
            className="input"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          >
            <option value="guitar">Guitarra</option>
            <option value="keyboard">Teclado</option>
          </select>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
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