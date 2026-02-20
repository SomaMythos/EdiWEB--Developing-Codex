import React, { useEffect, useState } from 'react';
import { dayConfigApi } from '../services/api';
import './DailyPlanner.css';

const DailyPlanner = () => {

  const [config, setConfig] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadConfig = async () => {
    const res = await dayConfigApi.get();
    setConfig(res.data.data);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const saveConfig = async () => {
    await dayConfigApi.save({
      sleep_start: config.sleep_start,
      sleep_end: config.sleep_end,
      work_start: config.work_start,
      work_end: config.work_end,
      buffer_between: parseInt(config.buffer_between, 10),
      granularity_min: parseInt(config.granularity_min, 10),
      avoid_category_adjacent: !!config.avoid_category_adjacent,
    });
    setModalOpen(false);
  };

  if (!config) return <div className="page-container">Carregando...</div>;

  return (
    <div className="page-container fade-in">

      <div className="daily-header">
        <h1>Daily Planner</h1>

        <button
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >
          ⚙ Configuração
        </button>
      </div>

      <div className="daily-placeholder">
        <p>Aqui será exibida a agenda gerada.</p>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Configuração do Dia</h3>

            <div className="config-grid">

              <label>Sono Início</label>
              <input
                type="time"
                value={config.sleep_start}
                onChange={(e) => setConfig({ ...config, sleep_start: e.target.value })}
              />

              <label>Sono Fim</label>
              <input
                type="time"
                value={config.sleep_end}
                onChange={(e) => setConfig({ ...config, sleep_end: e.target.value })}
              />

              <label>Trabalho Início</label>
              <input
                type="time"
                value={config.work_start}
                onChange={(e) => setConfig({ ...config, work_start: e.target.value })}
              />

              <label>Trabalho Fim</label>
              <input
                type="time"
                value={config.work_end}
                onChange={(e) => setConfig({ ...config, work_end: e.target.value })}
              />

              <label>Buffer (min)</label>
              <input
                type="number"
                value={config.buffer_between}
                onChange={(e) => setConfig({ ...config, buffer_between: e.target.value })}
              />

              <label>Granularidade (min)</label>
              <input
                type="number"
                value={config.granularity_min}
                onChange={(e) => setConfig({ ...config, granularity_min: e.target.value })}
              />

              <label>Evitar categorias adjacentes</label>
              <input
                type="checkbox"
                checked={!!config.avoid_category_adjacent}
                onChange={(e) => setConfig({ ...config, avoid_category_adjacent: e.target.checked })}
              />

            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveConfig}>Salvar</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default DailyPlanner;
