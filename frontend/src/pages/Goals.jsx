// src/pages/Goals.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Star as StarIcon, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { goalsApi, activitiesApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './Goals.css';


const initialFormState = {
  title: '',
  description: '',
  hasDeadline: false,
  deadline: '',
  difficulty: 1,
};




const Star = ({ filled, onClick, size = 18 }) => (
  <button type="button" className={`star-btn ${filled ? 'filled' : ''}`} onClick={onClick} aria-label="star">
    <StarIcon size={size} />
  </button>
);

const Goals = () => {
  const [mode, setMode] = useState('summary'); // 'summary' | 'category'
  const [home, setHome] = useState({ total_stars: 0, recent_achievements: [], categories_overview: [] });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');

  // Goal form (used in category view)
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState({ type: '', message: '' });
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);

  useEffect(() => {
    loadSummary();
    loadActivities();
  }, []);

  useEffect(() => {
    if (mode === 'category' && selectedCategory) {
      loadGoalsByCategory(selectedCategory.id);
    }
  }, [mode, selectedCategory]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const homeResp = await goalsApi.getHome();
      setHome(homeResp?.data?.data || { total_stars: 0, recent_achievements: [], categories_overview: [] });

      const catResp = await goalsApi.listCategories();
      setCategories(catResp?.data?.data || []);
    } catch (err) {
      console.error('Erro carregando summary:', err);
      setHome({ total_stars: 0, recent_achievements: [], categories_overview: [] });
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const r = await activitiesApi.list();
      setActivities(r.data.data || []);
    } catch (err) {
      console.error('Erro carregando atividades', err);
    }
  };

  const loadGoalsByCategory = async (categoryId) => {
    setLoading(true);
    try {
      const resp = await goalsApi.listByCategory(categoryId);
      setGoals(resp.data.data || []);
    } catch (err) {
      console.error('Erro carregando metas por categoria', err);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

const handleCreateCategory = async () => {
  if (!newCategoryName.trim()) return alert('Nome da categoria é obrigatório');

  try {
    await goalsApi.createCategory({ name: newCategoryName.trim() });
    setNewCategoryName('');
    await loadSummary();
  } catch (err) {
    console.error('Erro ao criar categoria', err);
    const msg = err?.response?.data?.detail || 'Erro ao criar categoria';
    alert(msg);
  }
};

const handleEditCategory = async (category) => {
  const newName = prompt('Novo nome da categoria:', category.name);
  if (!newName || !newName.trim()) return;

  try {
    await goalsApi.updateCategory(category.id, { name: newName.trim() });

    const catResp = await goalsApi.listCategories();
    const updatedCategories = catResp?.data?.data || [];
    setCategories(updatedCategories);

    if (selectedCategory?.id === category.id) {
      const updated = updatedCategories.find(c => c.id === category.id);
      setSelectedCategory(updated || null);
    }

  } catch (err) {
    console.error('Erro ao editar categoria', err);
    alert('Erro ao editar categoria');
  }
};

const handleDeleteCategory = async (categoryId) => {
  if (!window.confirm('Deseja realmente excluir esta categoria?')) return;

  try {
    await goalsApi.removeCategory(categoryId);

    const catResp = await goalsApi.listCategories();
    const updatedCategories = catResp?.data?.data || [];
    setCategories(updatedCategories);

    if (selectedCategory?.id === categoryId) {
      setSelectedCategory(null);
      setMode('summary');
    }

  } catch (err) {
    console.error('Erro ao excluir categoria', err);
    alert('Erro ao excluir categoria');
  }
};


  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setMode('category');
    setShowGoalForm(false);
    setEditingGoalId(null);
  };

  const handleBackToSummary = () => {
    setMode('summary');
    setSelectedCategory(null);
    loadSummary();
  };

  // -------- Goal form handlers (create / edit) --------
  const handleSubmitGoal = async (e) => {
    e.preventDefault();

    const payload = {
      title: formData.title,
      description: formData.description,
      deadline: formData.hasDeadline ? formData.deadline : null,
      difficulty: formData.difficulty,
      category_id: selectedCategory ? selectedCategory.id : null,
    };

    setUploadFeedback({ type: '', message: '' });
    setIsSubmittingGoal(true);

    const shouldKeepFormOpen = Boolean(photoFile);

    try {
      if (editingGoalId) {
        if (photoFile) {
          await goalsApi.updateWithFormData(editingGoalId, {
            ...payload,
            image: photoFile,
          });
          setUploadFeedback({ type: 'success', message: 'Upload da imagem concluído com sucesso.' });
        } else {
          await goalsApi.update(editingGoalId, payload);
        }
      } else {
        await goalsApi.create(photoFile ? { ...payload, image: photoFile } : payload);
        if (photoFile) {
          setUploadFeedback({ type: 'success', message: 'Upload da imagem concluído com sucesso.' });
        }
      }

      setFormData(initialFormState);
      setPhotoFile(null);
      setEditingGoalId(null);
      setShowGoalForm(shouldKeepFormOpen);
      if (selectedCategory) await loadGoalsByCategory(selectedCategory.id);
      else await loadSummary();
    } catch (err) {
      console.error('Erro salvando meta:', err);
      const msg = err?.response?.data?.detail || 'Erro ao salvar meta';
      setUploadFeedback({ type: 'error', message: photoFile ? `Falha no upload: ${msg}` : msg });
      alert(msg);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  const handleEditGoal = (goal) => {
    if (goal.status === 'concluida') return;
    setEditingGoalId(goal.id);
    setFormData({
      title: goal.title || '',
      description: goal.description || '',
      hasDeadline: Boolean(goal.deadline),
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      difficulty: goal.difficulty || 1,
    });
    setPhotoFile(null);
    setUploadFeedback({ type: '', message: '' });
    setShowGoalForm(true);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta meta?')) return;
    try {
      await goalsApi.remove(goalId);
      if (selectedCategory) await loadGoalsByCategory(selectedCategory.id);
      else await loadSummary();
    } catch (err) {
      console.error('Erro ao deletar meta', err);
      alert('Erro ao deletar meta');
    }
  };

  const handleConcludeGoal = async (goalId) => {
    try {
      await goalsApi.updateStatus(goalId, 'concluida');
      if (mode === 'category' && selectedCategory) await loadGoalsByCategory(selectedCategory.id);
      else await loadSummary();
    } catch (err) {
      console.error('Erro ao concluir meta', err);
      alert('Erro ao concluir meta');
    }
  };

  const handleLinkActivity = async (goalId, activityId) => {
    try {
      await goalsApi.linkActivity({ goal_id: goalId, activity_id: activityId });
      alert('Atividade vinculada');
    } catch (err) {
      console.error('Erro ao vincular atividade:', err);
      alert('Erro ao vincular atividade');
    }
  };

  const setDifficulty = (n) => setFormData({ ...formData, difficulty: n });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spin">⏳</div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="goals-page-wow">
      <div className="goals-left-column">
        <div
          className={`category-btn ${mode === 'summary' ? 'active' : ''}`}
          onClick={handleBackToSummary}
        >
          Sumário
        </div>

        {categories.map((c) => (
  <div
    key={c.id}
    className={`category-btn ${mode === 'category' && selectedCategory && selectedCategory.id === c.id ? 'active' : ''}`}
    onClick={() => handleSelectCategory(c)}
  >
    {c.name}
  </div>
))}

      </div>

      <div className="goals-main">
        <div className="goals-header-wrapper">
          <div className="goals-header-centered">
            <h1 className="goals-title">Metas</h1>

            <div className="stars-centered">
              <StarIcon size={28} className="star-yellow filled-star" />
              <span className="stars-number">{home.total_stars || 0}</span>
            </div>
          </div>

          <div className="header-actions-right">
  {mode === 'summary' ? (
    <div className="create-category-inline">
      <input
        value={newCategoryName}
        onChange={(e) => setNewCategoryName(e.target.value)}
        placeholder="Nova categoria"
      />
      <button className="btn" onClick={handleCreateCategory}>
        Criar categoria
      </button>
    </div>
  ) : (
    <div className="category-action-group">
      <button
        className="btn"
        onClick={() => {
          setShowGoalForm(true);
          setEditingGoalId(null);
          setUploadFeedback({ type: '', message: '' });
        }}
      >
        Criar Meta
      </button>

      <button
  className="btn btn-secondary"
  onClick={() => handleEditCategory(selectedCategory)}
>
  Editar Categoria
</button>


      <button
        className="btn btn-danger"
        onClick={() => {
          const confirmation = prompt(
            `Digite o nome da categoria "${selectedCategory.name}" para confirmar exclusão:`
          );

          if (confirmation !== selectedCategory.name) {
            alert('Nome incorreto. Exclusão cancelada.');
            return;
          }

          handleDeleteCategory(selectedCategory.id);
        }}
      >
        Excluir Categoria
      </button>
    </div>
  )}
</div>


        </div>

        {mode === 'summary' && (
          <>
            <div className="recent-section">
              <h3 className="section-title">Metas Recentes</h3>
              <div className="card recent-card-full">
                {home.recent_achievements && home.recent_achievements.length ? (
                  home.recent_achievements.map((r) => (
                    <div key={r.id} className="recent-item-wide">
                      {r.image_path ? (
                        <img
                          src={resolveMediaUrl(r.image_path)}
                          alt={r.title}
                          className="goal-thumb-img"
                        />
                      ) : (
                        <div className="thumb-box">Sem imagem</div>
                      )}
                      <div className="recent-mid">
                        <div className="recent-title">{r.title}</div>
                        <div className="recent-desc">{r.description}</div>
                      </div>
                      <div className="recent-right">
                        <div>{r.completed_at ? new Date(r.completed_at).toLocaleDateString('pt-BR') : ''}</div>
                        <div className="recent-stars">{r.difficulty || 1}★</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-centered">Nenhuma meta concluída ainda</div>
                )}
              </div>
            </div>

            <div className="progress-section">
              <h3 className="section-title">Progresso</h3>
              <div className="card progress-card-full">
                {home.categories_overview && home.categories_overview.length ? (
                  home.categories_overview.map((c) => {
                    const total = c.total || 0;
                    const completed = c.completed || 0;
                    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
                    return (
                      <div key={c.id} className="progress-row-compact">
                        <div className="progress-label-compact">{c.name}</div>
                        <div className="progress-bar-outer-compact">
                          <div className="progress-bar-inner-compact" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="progress-count-compact">{completed}/{total}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty">Sem categorias / progresso</div>
                )}
              </div>
            </div>
          </>
        )}

        {mode === 'category' && selectedCategory && (
          <>
            <div className="category-header">
              <h2>{selectedCategory.name}</h2>
            </div>

            <div className="category-body">
              <div className="goals-list">
                {showGoalForm && (
                  <div className="card goal-form-card">
                    <h3>{editingGoalId ? 'Editar Meta' : 'Nova Meta'}</h3>
                    <form onSubmit={handleSubmitGoal}>
                      <div className="form-row">
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Título"
                          required
                        />
                      </div>

                      <div className="form-row">
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descrição"
                        />
                      </div>

                      <div className="form-row star-picker-row">
                        <label>Dificuldade</label>
                        <div className="stars-picker">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <Star key={v} filled={v <= (formData.difficulty || 1)} onClick={() => setDifficulty(v)} />
                          ))}
                        </div>
                      </div>

                      <div className="form-row">
                        <label>Prazo (opcional)</label>
                        <input
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value, hasDeadline: !!e.target.value })}
                        />
                      </div>

                      <div className="form-row">
                        <label>Foto (opcional)</label>
                        <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)} />
                        {uploadFeedback.message ? (
                          <div className={`upload-feedback ${uploadFeedback.type}`}>{uploadFeedback.message}</div>
                        ) : null}
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowGoalForm(false);
                            setFormData(initialFormState);
                            setPhotoFile(null);
                            setUploadFeedback({ type: '', message: '' });
                          }}
                        >
                          Cancelar
                        </button>

                        <button type="submit" className="btn btn-primary" disabled={isSubmittingGoal}>
                          {isSubmittingGoal ? 'Enviando...' : (editingGoalId ? 'Salvar' : 'Criar')}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {!showGoalForm && goals.length === 0 && (
                  <div className="card empty">Nenhuma meta nesta categoria</div>
                )}

                {goals.map((goal) => (
                  <div key={goal.id} className={`card goal-card ${goal.status === 'concluida' ? 'goal-completed' : 'goal-active'}`}
>
                    <div className="goal-left">
                      <div className="thumb-box">
                        {goal.image_path ? (
                          <img src={resolveMediaUrl(goal.image_path)} alt="meta" className="goal-thumb" />
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                    </div>

                    <div className="goal-middle">
                      <div className="goal-title">{goal.title}</div>
                      <div className="goal-desc">{goal.description}</div>
                    </div>

                    <div className="goal-right">
  <div className="goal-stars-badge">
    <StarIcon size={42} className="goal-star-icon" />
    <span className="goal-star-number">{goal.difficulty}</span>
  </div>
</div>

<div className="goal-actions">
  {goal.status !== 'concluida' && (
    <>
      <button className="goal-icon-btn" onClick={() => handleConcludeGoal(goal.id)}>
        ✅
      </button>

      <button className="goal-icon-btn" onClick={() => handleEditGoal(goal)}>
        ✏️
      </button>
    </>
  )}

  <button className="goal-icon-btn delete-btn" onClick={() => handleDeleteGoal(goal.id)}>
    ❌
  </button>
</div>



                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Goals;
