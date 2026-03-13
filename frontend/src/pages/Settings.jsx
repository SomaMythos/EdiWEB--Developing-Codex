import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Database,
  Download,
  ExternalLink,
  FileText,
  Image,
  Monitor,
  Power,
  Save,
  TrendingDown,
  User,
} from 'lucide-react';
import { exportApi, notificationsApi, systemIntegrationApi, userApi } from '../services/api';
import {
  DEFAULT_SOUND_PREFERENCES,
  loadSoundPreferences,
  saveSoundPreferences,
} from '../services/notificationSound';
import './Settings.css';

const notificationFeatures = [
  { key: 'goals', label: 'Metas' },
  { key: 'daily', label: 'Resumo diário' },
  { key: 'consumables', label: 'Consumíveis' },
  { key: 'shopping', label: 'Compras' },
  { key: 'custom', label: 'Customizadas' },
  { key: 'journal', label: 'Diário semanal' },
];

const Settings = () => {
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [profileForm, setProfileForm] = useState({
    name: '',
    birth_date: '',
    height: '',
    gender: '',
    photo_path: '',
  });
  const [metricForm, setMetricForm] = useState({
    weight: '',
    body_fat: '',
    muscle_mass: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingSystemIntegration, setSavingSystemIntegration] = useState(false);
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState([]);
  const [soundPrefs, setSoundPrefs] = useState(DEFAULT_SOUND_PREFERENCES);
  const [systemIntegration, setSystemIntegration] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, metricsRes, notificationPrefsRes, systemIntegrationRes] = await Promise.all([
        userApi.getProfile(),
        userApi.getMetrics(),
        notificationsApi.getPreferences(),
        systemIntegrationApi.getStatus(),
      ]);

      const profileData = profileRes.data.data;
      if (profileData) {
        setProfile(profileData);
        setProfileForm({
          name: profileData.name || '',
          birth_date: profileData.birth_date || '',
          height: profileData.height || '',
          gender: profileData.gender || '',
          photo_path: profileData.photo_path || '',
        });
      }

      setMetrics(metricsRes.data.data || []);
      setNotificationPrefs(notificationPrefsRes.data.data || []);
      setSystemIntegration(systemIntegrationRes.data.data || null);
      setSoundPrefs(loadSoundPreferences());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    try {
      await userApi.updateProfile({
        ...profileForm,
        height: profileForm.height === '' ? null : parseFloat(profileForm.height),
        gender: profileForm.gender || null,
        photo_path: profileForm.photo_path || null,
      });
      alert('Perfil salvo com sucesso!');
      loadData();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro ao salvar perfil');
    }
  };

  const handleAddMetric = async (event) => {
    event.preventDefault();

    try {
      if (!profile) {
        await userApi.updateProfile({
          name: 'Usuário',
          birth_date: null,
          height: null,
          gender: null,
          photo_path: null,
        });
        await loadData();
      }

      const userId = profile?.id || 1;
      await userApi.addMetric({
        user_id: userId,
        weight: parseFloat(metricForm.weight),
        body_fat: metricForm.body_fat === '' ? null : parseFloat(metricForm.body_fat),
        muscle_mass: metricForm.muscle_mass === '' ? null : parseFloat(metricForm.muscle_mass),
        notes: metricForm.notes || null,
        date: metricForm.date,
      });

      setMetricForm({
        weight: '',
        body_fat: '',
        muscle_mass: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
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

  const getNotificationPreference = (featureKey) => {
    return notificationPrefs.find((item) => item.feature_key === featureKey) || {
      feature_key: featureKey,
      enabled: true,
      channels: ['in_app', 'sound'],
      quiet_hours: null,
    };
  };

  const handleToggleNotificationFeature = async (featureKey, enabled) => {
    const updatedPrefs = notificationFeatures.map((feature) => {
      if (feature.key === featureKey) {
        return {
          ...getNotificationPreference(feature.key),
          feature_key: feature.key,
          enabled,
        };
      }

      return {
        ...getNotificationPreference(feature.key),
        feature_key: feature.key,
      };
    });

    setNotificationPrefs(updatedPrefs);
    setSavingNotifications(true);

    try {
      const response = await notificationsApi.savePreferences(updatedPrefs);
      setNotificationPrefs(response.data.data || updatedPrefs);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      alert('Erro ao salvar preferências de notificação');
      loadData();
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSoundPrefChange = (changes) => {
    const updated = saveSoundPreferences({ ...soundPrefs, ...changes });
    setSoundPrefs(updated);
  };

  const handleWindowsStartupChange = async (enabled) => {
    if (!systemIntegration?.supported) {
      alert('Esta integração só está disponível no Windows.');
      return;
    }

    setSavingSystemIntegration(true);
    try {
      const response = await systemIntegrationApi.setWindowsStartup(enabled);
      setSystemIntegration(response.data.data || null);
      alert(enabled ? 'Inicialização automática ativada.' : 'Inicialização automática desativada.');
    } catch (error) {
      console.error('Error updating Windows startup:', error);
      alert('Erro ao atualizar a inicialização automática.');
      loadData();
    } finally {
      setSavingSystemIntegration(false);
    }
  };

  const handleCreateDesktopShortcut = async () => {
    if (!systemIntegration?.supported) {
      alert('Esta integração só está disponível no Windows.');
      return;
    }

    setSavingSystemIntegration(true);
    try {
      const response = await systemIntegrationApi.createDesktopShortcut();
      setSystemIntegration(response.data.data || null);
      alert('Atalho criado com sucesso na área de Trabalho.');
    } catch (error) {
      console.error('Error creating desktop shortcut:', error);
      alert('Erro ao criar o atalho na área de Trabalho.');
      loadData();
    } finally {
      setSavingSystemIntegration(false);
    }
  };

  const handleResetDatabase = async () => {
    const confirmationText = window.prompt('Digite ZERAR para limpar todos os dados do app e recriar o banco vazio.');
    if (confirmationText === null) return;

    if (confirmationText.trim().toUpperCase() !== 'ZERAR') {
      alert('Confirmação inválida. Nenhum dado foi apagado.');
      return;
    }

    setResettingDatabase(true);
    try {
      await systemIntegrationApi.resetDatabase(confirmationText.trim());
      alert('Banco de dados zerado com sucesso.');
      await loadData();
    } catch (error) {
      console.error('Error resetting database:', error);
      alert(error?.response?.data?.detail || 'Erro ao zerar o banco de dados.');
    } finally {
      setResettingDatabase(false);
    }
  };

  const calculateAge = () => {
    if (!profile?.birth_date) return null;
    const birthDate = new Date(profile.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
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
        <div className="spin">...</div>
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
        </div>
      </header>

      <div className="settings-grid">
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
                onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
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
                onChange={(event) => setProfileForm({ ...profileForm, birth_date: event.target.value })}
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
                onChange={(event) => setProfileForm({ ...profileForm, height: event.target.value })}
                placeholder="170"
              />
            </div>

            <div className="form-group">
              <label className="label">Gênero</label>
              <select
                className="input"
                value={profileForm.gender}
                onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}
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
                onChange={(event) => setProfileForm({ ...profileForm, photo_path: event.target.value })}
                placeholder="/uploads/minha-foto.jpg"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={20} />
              Salvar Perfil
            </button>
          </form>
        </div>

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
                  onChange={(event) => setMetricForm({ ...metricForm, weight: event.target.value })}
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
                  onChange={(event) => setMetricForm({ ...metricForm, body_fat: event.target.value })}
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
                  onChange={(event) => setMetricForm({ ...metricForm, muscle_mass: event.target.value })}
                  placeholder="32"
                />
              </div>

              <div className="form-group">
                <label className="label">Data</label>
                <input
                  type="date"
                  className="input"
                  value={metricForm.date}
                  onChange={(event) => setMetricForm({ ...metricForm, date: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Observações</label>
              <textarea
                className="input"
                value={metricForm.notes}
                onChange={(event) => setMetricForm({ ...metricForm, notes: event.target.value })}
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
                    {weightTrend.diff > 0 ? '+' : ''}
                    {weightTrend.diff.toFixed(1)} kg
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
                    <span className="history-date">{new Date(metric.date).toLocaleDateString('pt-BR')}</span>
                    <span className="history-value">
                      {metric.weight} kg
                      {metric.body_fat != null && ` - ${metric.body_fat}% gordura`}
                      {metric.muscle_mass != null && ` - ${metric.muscle_mass}kg músculo`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="notifications-section card">
          <div className="section-header">
            <Bell size={24} />
            <h2>Notificações</h2>
          </div>

          <div className="notification-feature-list">
            {notificationFeatures.map((feature) => {
              const pref = getNotificationPreference(feature.key);
              return (
                <div key={feature.key} className="notification-feature-item">
                  <div>
                    <p className="notification-feature-title">{feature.label}</p>
                    <p className="notification-feature-desc">
                      {pref.enabled
                        ? 'Notificações ativas para esta feature.'
                        : 'Notificações desativadas para esta feature.'}
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!pref.enabled}
                      disabled={savingNotifications}
                      onChange={(event) => handleToggleNotificationFeature(feature.key, event.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="notification-sound-settings">
            <h3>Som das notificações</h3>

            <div className="notification-sound-row">
              <div>
                <p className="notification-feature-title">Som habilitado</p>
                <p className="notification-feature-desc">Ativa ou desativa todos os sons de notificação.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!soundPrefs.enabled}
                  onChange={(event) => handleSoundPrefChange({ enabled: event.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="notification-sound-row">
              <div>
                <p className="notification-feature-title">Volume</p>
                <p className="notification-feature-desc">Ajuste o volume de 0% a 100%.</p>
              </div>
              <div className="notification-volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundPrefs.volume}
                  onChange={(event) => handleSoundPrefChange({ volume: Number(event.target.value) })}
                  disabled={!soundPrefs.enabled}
                />
                <span>{Math.round(soundPrefs.volume * 100)}%</span>
              </div>
            </div>

            <div className="notification-sound-row">
              <div>
                <p className="notification-feature-title">Quiet hours</p>
                <p className="notification-feature-desc">Silencia sons durante o horário configurado.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!soundPrefs.quietHoursEnabled}
                  onChange={(event) => handleSoundPrefChange({ quietHoursEnabled: event.target.checked })}
                  disabled={!soundPrefs.enabled}
                />
                <span className="slider" />
              </label>
            </div>

            {soundPrefs.quietHoursEnabled && (
              <div className="quiet-hours-grid">
                <label className="label">
                  Início
                  <input
                    type="time"
                    className="input"
                    value={soundPrefs.quietHoursStart}
                    onChange={(event) => handleSoundPrefChange({ quietHoursStart: event.target.value })}
                    disabled={!soundPrefs.enabled}
                  />
                </label>
                <label className="label">
                  Fim
                  <input
                    type="time"
                    className="input"
                    value={soundPrefs.quietHoursEnd}
                    onChange={(event) => handleSoundPrefChange({ quietHoursEnd: event.target.value })}
                    disabled={!soundPrefs.enabled}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="system-integration-section card">
          <div className="section-header">
            <Power size={24} />
            <h2>Inicialização e Atalho</h2>
          </div>

          <div className="integration-stack">
            <div className="integration-item">
              <div>
                <p className="notification-feature-title">Executar ao iniciar o Windows</p>
                <p className="notification-feature-desc">
                  Inicia backend e frontend em segundo plano e abre automaticamente o app no navegador padrão.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!systemIntegration?.windows_startup_enabled}
                  disabled={savingSystemIntegration || !systemIntegration?.supported}
                  onChange={(event) => handleWindowsStartupChange(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="integration-item integration-item-action">
              <div>
                <p className="notification-feature-title">Atalho silencioso na área de Trabalho</p>
                <p className="notification-feature-desc">
                  O atalho usa o ícone do projeto e abre {systemIntegration?.launch_url || 'http://localhost:3000'} sem mostrar janelas de prompt.
                </p>
                {systemIntegration?.desktop_shortcut_path && (
                  <p className="integration-meta">{systemIntegration.desktop_shortcut_path}</p>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary integration-button"
                disabled={savingSystemIntegration || !systemIntegration?.supported}
                onClick={handleCreateDesktopShortcut}
              >
                <Monitor size={18} />
                {systemIntegration?.desktop_shortcut_exists ? 'Recriar Atalho' : 'Criar Atalho'}
              </button>
            </div>

            <div className="integration-hint">
              <ExternalLink size={16} />
              <span>
                Ao usar o launcher silencioso, o navegador padrão será aberto em{' '}
                <a href={systemIntegration?.launch_url || 'http://localhost:3000'} target="_blank" rel="noreferrer">
                  {systemIntegration?.launch_url || 'http://localhost:3000'}
                </a>
                .
              </span>
            </div>
          </div>
        </div>

        <div className="export-section card">
          <div className="section-header">
            <Download size={24} />
            <h2>Exportar Dados</h2>
          </div>

          <div className="export-options">
            <button className="export-button" onClick={() => handleExport('json')} disabled={exporting}>
              <Database size={20} />
              <div className="export-info">
                <h3>Backup Completo (JSON)</h3>
                <p>Exporta todos os dados em formato JSON</p>
              </div>
            </button>

            <button className="export-button" onClick={() => handleExport('csv')} disabled={exporting}>
              <FileText size={20} />
              <div className="export-info">
                <h3>Tabelas (CSV)</h3>
                <p>Exporta todas as tabelas em arquivos CSV</p>
              </div>
            </button>

            <button className="export-button" onClick={() => handleExport('activities')} disabled={exporting}>
              <FileText size={20} />
              <div className="export-info">
                <h3>Relatório de Atividades</h3>
                <p>Exporta histórico de atividades</p>
              </div>
            </button>

            <button className="export-button" onClick={() => handleExport('goals')} disabled={exporting}>
              <FileText size={20} />
              <div className="export-info">
                <h3>Progresso de Metas</h3>
                <p>Exporta relatório de progresso das metas</p>
              </div>
            </button>
          </div>

          {exporting && (
            <div className="exporting-indicator">
              <div className="spin">...</div>
              <p>Exportando...</p>
            </div>
          )}
        </div>

        <div className="danger-section card">
          <div className="section-header">
            <AlertTriangle size={24} />
            <h2>Banco de Dados</h2>
          </div>

          <div className="danger-card">
            <div className="danger-copy">
              <p className="notification-feature-title">Limpar metadados</p>
              <p className="notification-feature-desc">
                Apaga todos os dados do app e recria a base vazia.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              onClick={handleResetDatabase}
              disabled={resettingDatabase}
            >
              <Database size={18} />
              {resettingDatabase ? 'Limpando...' : 'Limpar metadados'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
