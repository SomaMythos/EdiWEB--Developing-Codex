import React, { useState, useEffect } from 'react';
import { User, Download, FileText, Database, Save, TrendingDown, Image } from 'lucide-react';
import { userApi, exportApi } from '../services/api';
import './Settings.css';

const Settings = () => {
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [profileForm, setProfileForm] = useState({
    name: '',
    birth_date: '',
    height: '',
    gender: '',
    photo_path: ''
  });
  const [metricForm, setMetricForm] = useState({
    weight: '',
    body_fat: '',
    muscle_mass: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, metricsRes] = await Promise.all([
        userApi.getProfile(),
        userApi.getMetrics()
      ]);

      const profileData = profileRes.data.data;
      if (profileData) {
        setProfile(profileData);
        setProfileForm({
          name: profileData.name || '',
          birth_date: profileData.birth_date || '',
          height: profileData.height || '',
          gender: profileData.gender || '',
          photo_path: profileData.photo_path || ''
        });
      }

      setMetrics(metricsRes.data.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    try {
      await userApi.updateProfile({
        ...profileForm,
        height: profileForm.height === '' ? null : parseFloat(profileForm.height),
        gender: profileForm.gender || null,
        photo_path: profileForm.photo_path || null
      });
      alert('Perfil salvo com sucesso!');
      loadData();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro ao salvar perfil');
    }
  };

  const handleAddMetric = async (e) => {
    e.preventDefault();
    
    try {
      // Primeiro garante que existe um perfil
      if (!profile) {
        await userApi.updateProfile({ name: 'Usuário', birth_date: null, height: null, gender: null, photo_path: null });
        await loadData();
      }
      
      const userId = profile?.id || 1;
      await userApi.addMetric({
        user_id: userId,
        weight: parseFloat(metricForm.weight),
        body_fat: metricForm.body_fat === '' ? null : parseFloat(metricForm.body_fat),
        muscle_mass: metricForm.muscle_mass === '' ? null : parseFloat(metricForm.muscle_mass),
        notes: metricForm.notes || null,
        date: metricForm.date
      });

      setMetricForm({
        weight: '',
        body_fat: '',
        muscle_mass: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (error) {
      console.error('Error adding metric:', error);
      alert('Erro ao adicionar métrica');
    }
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      let result;
      switch (type) {
        case 'json':
          result = await exportApi.exportJson();
          break;
        case 'csv':
          result = await exportApi.exportCsv();
          break;
        case 'activities':
          result = await exportApi.exportActivitiesReport();
          break;
        case 'goals':
          result = await exportApi.exportGoalsProgress();
          break;
        default:
          return;
      }
      
      alert(`Exportação concluída! Arquivo salvo em: ${result.data.data.filepath || result.data.data.filepaths}`);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const calculateAge = () => {
    if (!profile?.birth_date) return null;
    const birthDate = new Date(profile.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getWeightTrend = () => {
    if (metrics.length < 2) return null;
    const latest = metrics[0].weight;
    const previous = metrics[1].weight;
    const diff = latest - previous;
    return { diff, direction: diff > 0 ? 'up' : 'down' };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spin">⏳</div>
        <p>Carregando...</p>
      </div>
    );
  }

  const age = calculateAge();
  const weightTrend = getWeightTrend();

  return (
    <div className="settings-page fade-in">
      <header className="page-header">
        <div>
          <h1>Configurações</h1>
          <p className="subtitle">Gerencie seu perfil e dados do sistema</p>
        </div>
      </header>

      <div className="settings-grid">
        {/* User Profile */}
        <div className="profile-section card">
          <div className="section-header">
            <User size={24} />
            <h2>Perfil do Usuário</h2>
            {profile?.photo_path && <Image size={18} />}
          </div>

          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group">
              <label className="label">Nome</label>
              <input
                type="text"
                className="input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Data de Nascimento</label>
              <input
                type="date"
                className="input"
                value={profileForm.birth_date}
                onChange={(e) => setProfileForm({ ...profileForm, birth_date: e.target.value })}
              />
              {age && <p className="form-hint">{age} anos</p>}
            </div>

            <div className="form-group">
              <label className="label">Altura (cm)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={profileForm.height}
                onChange={(e) => setProfileForm({ ...profileForm, height: e.target.value })}
                placeholder="170"
              />
            </div>

            <div className="form-group">
              <label className="label">Gênero</label>
              <select
                className="input"
                value={profileForm.gender}
                onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
              >
                <option value="">Não informar</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">Foto (caminho/URL)</label>
              <input
                type="text"
                className="input"
                value={profileForm.photo_path}
                onChange={(e) => setProfileForm({ ...profileForm, photo_path: e.target.value })}
                placeholder="/uploads/minha-foto.jpg"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={20} />
              Salvar Perfil
            </button>
          </form>
        </div>

        {/* Body Metrics */}
        <div className="metrics-section card">
          <div className="section-header">
            <TrendingDown size={24} />
            <h2>Métricas Corporais</h2>
          </div>

          <form onSubmit={handleAddMetric} className="metrics-form">
            <div className="form-row">
              <div className="form-group">
                <label className="label">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={metricForm.weight}
                  onChange={(e) => setMetricForm({ ...metricForm, weight: e.target.value })}
                  placeholder="70.5"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">% Gordura (opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={metricForm.body_fat}
                  onChange={(e) => setMetricForm({ ...metricForm, body_fat: e.target.value })}
                  placeholder="18.4"
                />
              </div>

              <div className="form-group">
                <label className="label">Massa muscular (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={metricForm.muscle_mass}
                  onChange={(e) => setMetricForm({ ...metricForm, muscle_mass: e.target.value })}
                  placeholder="32"
                />
              </div>

              <div className="form-group">
                <label className="label">Data</label>
                <input
                  type="date"
                  className="input"
                  value={metricForm.date}
                  onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Observações</label>
              <textarea
                className="input"
                value={metricForm.notes}
                onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
                placeholder="Ex: treino intenso, retenção..."
              />
            </div>

            <button type="submit" className="btn btn-success">
              <Save size={20} />
              Adicionar Registro
            </button>
          </form>

          {metrics.length > 0 && (
            <div className="metrics-summary">
              <div className="metric-card">
                <p className="metric-label">Peso Atual</p>
                <p className="metric-value">{metrics[0].weight} kg</p>
                {weightTrend && (
                  <p className={`metric-trend ${weightTrend.direction}`}>
                    {weightTrend.diff > 0 ? '+' : ''}{weightTrend.diff.toFixed(1)} kg
                  </p>
                )}
              </div>

              {profile?.height && metrics[0] && (
                <div className="metric-card">
                  <p className="metric-label">IMC</p>
                  <p className="metric-value">
                    {(metrics[0].weight / ((profile.height / 100) ** 2)).toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          )}

          {metrics.length > 0 && (
            <div className="metrics-history">
              <h3>Histórico</h3>
              <div className="history-list">
                {metrics.slice(0, 5).map((metric, index) => (
                  <div key={index} className="history-item">
                    <span className="history-date">
                      {new Date(metric.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="history-value">
                      {metric.weight} kg
                      {metric.body_fat != null && ` • ${metric.body_fat}% gordura`}
                      {metric.muscle_mass != null && ` • ${metric.muscle_mass}kg músculo`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export Data */}
        <div className="export-section card">
          <div className="section-header">
            <Download size={24} />
            <h2>Exportar Dados</h2>
          </div>

          <div className="export-options">
            <button
              className="export-button"
              onClick={() => handleExport('json')}
              disabled={exporting}
            >
              <Database size={20} />
              <div className="export-info">
                <h3>Backup Completo (JSON)</h3>
                <p>Exporta todos os dados em formato JSON</p>
              </div>
            </button>

            <button
              className="export-button"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              <FileText size={20} />
              <div className="export-info">
                <h3>Tabelas (CSV)</h3>
                <p>Exporta todas as tabelas em arquivos CSV</p>
              </div>
            </button>

            <button
              className="export-button"
              onClick={() => handleExport('activities')}
              disabled={exporting}
            >
              <FileText size={20} />
              <div className="export-info">
                <h3>Relatório de Atividades</h3>
                <p>Exporta histórico de atividades</p>
              </div>
            </button>

            <button
              className="export-button"
              onClick={() => handleExport('goals')}
              disabled={exporting}
            >
              <FileText size={20} />
              <div className="export-info">
                <h3>Progresso de Metas</h3>
                <p>Exporta relatório de progresso das metas</p>
              </div>
            </button>
          </div>

          {exporting && (
            <div className="exporting-indicator">
              <div className="spin">⏳</div>
              <p>Exportando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
