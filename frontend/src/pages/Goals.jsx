import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Flag, Plus, Star, Target, Trash2 } from 'lucide-react';
import { goalsApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './Goals.css';

const initialGoalForm = {
  title: '',
  description: '',
  deadline: '',
  difficulty: 1,
  goal_mode: 'simple',
  milestones: [],
};

const emptyMilestone = () => ({ title: '', description: '', is_completed: false });

const Goals = () => {
  const [mode, setMode] = useState('summary');
  const [home, setHome] = useState({ total_stars: 0, recent_achievements: [], categories_overview: [] });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [formData, setFormData] = useState(initialGoalForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (mode === 'category' && selectedCategory) {
      loadGoalsByCategory(selectedCategory.id);
    }
  }, [mode, selectedCategory]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [homeResponse, categoriesResponse] = await Promise.all([
        goalsApi.getHome(),
        goalsApi.listCategories(),
      ]);
      setHome(homeResponse.data.data || { total_stars: 0, recent_achievements: [], categories_overview: [] });
      setCategories(categoriesResponse.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar resumo de metas:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o resumo de metas.' });
    } finally {
      setLoading(false);
    }
  };

  const loadGoalsByCategory = async (categoryId) => {
    setLoading(true);
    try {
      const response = await goalsApi.listByCategory(categoryId);
      setGoals(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar metas da categoria:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar as metas da categoria.' });
    } finally {
      setLoading(false);
    }
  };

  const resetGoalForm = () => {
    setFormData(initialGoalForm);
    setPhotoFile(null);
    setEditingGoalId(null);
    setShowGoalForm(false);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await goalsApi.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      await loadSummary();
      setFeedback({ type: 'success', message: 'Categoria criada.' });
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      setFeedback({ type: 'error', message: 'Erro ao criar categoria.' });
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory) return;
    const nextName = window.prompt('Novo nome da categoria:', selectedCategory.name);
    if (!nextName || !nextName.trim()) return;
    try {
      await goalsApi.updateCategory(selectedCategory.id, { name: nextName.trim() });
      await loadSummary();
      const refreshed = (await goalsApi.listCategories()).data.data || [];
      const current = refreshed.find((item) => item.id === selectedCategory.id) || null;
      setCategories(refreshed);
      setSelectedCategory(current);
      setFeedback({ type: 'success', message: 'Categoria atualizada.' });
    } catch (error) {
      console.error('Erro ao editar categoria:', error);
      setFeedback({ type: 'error', message: 'Erro ao editar categoria.' });
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    if (!window.confirm(`Excluir a categoria "${selectedCategory.name}" e suas metas?`)) return;
    try {
      await goalsApi.removeCategory(selectedCategory.id);
      setSelectedCategory(null);
      setMode('summary');
      await loadSummary();
      setFeedback({ type: 'success', message: 'Categoria excluída.' });
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir categoria.' });
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setMode('category');
    resetGoalForm();
  };

  const handleAddMilestone = () => {
    setFormData((prev) => ({ ...prev, milestones: [...prev.milestones, emptyMilestone()] }));
  };

  const handleUpdateMilestoneDraft = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleRemoveMilestoneDraft = (index) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmitGoal = async (event) => {
    event.preventDefault();
    if (!selectedCategory) return;

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        deadline: formData.deadline || null,
        difficulty: formData.difficulty,
        category_id: selectedCategory.id,
        goal_mode: formData.goal_mode,
      };

      let goalId = editingGoalId;
      if (editingGoalId) {
        if (photoFile) {
          await goalsApi.updateWithFormData(editingGoalId, { ...payload, image: photoFile });
        } else {
          await goalsApi.update(editingGoalId, { ...payload, milestones: formData.milestones });
        }
      } else {
        const response = await goalsApi.create(photoFile ? { ...payload, image: photoFile } : payload);
        goalId = response.data.data.id;
      }

      if (goalId && formData.goal_mode === 'milestones') {
        await goalsApi.syncMilestones(goalId, formData.milestones.filter((item) => item.title.trim()).map((item, index) => ({
          ...item,
          sort_order: index,
        })));
      }

      if (goalId && formData.goal_mode === 'simple' && editingGoalId) {
        await goalsApi.syncMilestones(goalId, []);
      }

      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      resetGoalForm();
      setFeedback({ type: 'success', message: editingGoalId ? 'Meta atualizada.' : 'Meta criada.' });
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar meta.' });
    }
  };

  const handleEditGoal = (goal) => {
    setEditingGoalId(goal.id);
    setFormData({
      title: goal.title || '',
      description: goal.description || '',
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      difficulty: goal.difficulty || 1,
      goal_mode: goal.goal_mode || 'simple',
      milestones: (goal.milestones || []).map((milestone) => ({
        id: milestone.id,
        title: milestone.title || '',
        description: milestone.description || '',
        is_completed: !!milestone.is_completed,
        sort_order: milestone.sort_order,
      })),
    });
    setPhotoFile(null);
    setShowGoalForm(true);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Excluir esta meta?')) return;
    try {
      await goalsApi.remove(goalId);
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      setFeedback({ type: 'success', message: 'Meta excluída.' });
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir meta.' });
    }
  };

  const handleConcludeGoal = async (goalId) => {
    try {
      await goalsApi.updateStatus(goalId, 'concluida');
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      setFeedback({ type: 'success', message: 'Meta concluída.' });
    } catch (error) {
      console.error('Erro ao concluir meta:', error);
      setFeedback({ type: 'error', message: 'Erro ao concluir meta.' });
    }
  };

  const handleToggleMilestoneStatus = async (milestoneId, currentValue) => {
    try {
      await goalsApi.updateMilestoneStatus(milestoneId, !currentValue);
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
    } catch (error) {
      console.error('Erro ao atualizar etapa:', error);
      setFeedback({ type: 'error', message: 'Erro ao atualizar etapa.' });
    }
  };

  if (loading) {
    return (
      <div className="goals-page-wow">
        <div className="card goals-loading">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="goals-page-wow">
      <aside className="goals-left-column">
        <button type="button" className={`category-btn ${mode === 'summary' ? 'active' : ''}`} onClick={() => { setMode('summary'); setSelectedCategory(null); resetGoalForm(); loadSummary(); }}>
          Sumário
        </button>
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            className={`category-btn ${selectedCategory?.id === category.id ? 'active' : ''}`}
            onClick={() => handleSelectCategory(category)}
          >
            {category.name}
          </button>
        ))}
      </aside>

      <section className="goals-main">
        {feedback.message ? <div className={`goals-feedback ${feedback.type}`}>{feedback.message}</div> : null}

        <header className="goals-header-wrapper">
          <div className="goals-header-centered">
            <h1 className="goals-title">Metas</h1>
            <div className="stars-centered">
              <Star size={24} className="star-yellow" />
              <span className="stars-number">{home.total_stars || 0}</span>
            </div>
          </div>

          <div className="header-actions-right">
            {mode === 'summary' ? (
              <div className="create-category-inline">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Nova categoria"
                />
                <button className="btn btn-primary" onClick={handleCreateCategory}>
                  <Plus size={16} /> Criar
                </button>
              </div>
            ) : (
              <div className="category-action-group">
                <button className="btn btn-primary" onClick={() => { setShowGoalForm(true); setEditingGoalId(null); setFormData(initialGoalForm); }}>
                  <Plus size={16} /> Nova meta
                </button>
                <button className="btn btn-secondary" onClick={handleEditCategory}>Editar categoria</button>
                <button className="btn btn-danger" onClick={handleDeleteCategory}>Excluir categoria</button>
              </div>
            )}
          </div>
        </header>

        {mode === 'summary' ? (
          <div className="goals-summary-grid">
            <div className="card summary-card-block">
              <h2 className="section-title">Metas recentes</h2>
              {home.recent_achievements?.length ? home.recent_achievements.map((goal) => (
                <div key={goal.id} className="recent-item-wide">
                  {goal.image_path ? <img src={resolveMediaUrl(goal.image_path)} alt={goal.title} className="goal-thumb-img" /> : <div className="thumb-box">Sem imagem</div>}
                  <div className="recent-mid">
                    <div className="recent-title">{goal.title}</div>
                    <div className="recent-desc">{goal.description || 'Sem descrição.'}</div>
                  </div>
                  <div className="recent-right">
                    <div>{goal.completed_at ? new Date(goal.completed_at).toLocaleDateString('pt-BR') : ''}</div>
                    <div className="recent-stars">{goal.difficulty || 1}★</div>
                  </div>
                </div>
              )) : <div className="empty-centered">Nenhuma meta concluída ainda.</div>}
            </div>

            <div className="card summary-card-block">
              <h2 className="section-title">Progresso por categoria</h2>
              {home.categories_overview?.length ? home.categories_overview.map((category) => {
                const total = category.total || 0;
                const completed = category.completed || 0;
                const percentage = total ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={category.id} className="progress-row-compact">
                    <div className="progress-label-compact">{category.name}</div>
                    <div className="progress-bar-outer-compact">
                      <div className="progress-bar-inner-compact" style={{ width: `${percentage}%` }} />
                    </div>
                    <div className="progress-count-compact">{completed}/{total}</div>
                  </div>
                );
              }) : <div className="empty-centered">Sem categorias ainda.</div>}
            </div>
          </div>
        ) : (
          <div className="category-body">
            <div className="goal-category-header">
              <h2>{selectedCategory?.name}</h2>
              <p>Metas simples e metas fragmentadas em etapas convivem no mesmo fluxo.</p>
            </div>

            {showGoalForm && (
              <div className="card goal-form-card">
                <h3>{editingGoalId ? 'Editar meta' : 'Nova meta'}</h3>
                <form onSubmit={handleSubmitGoal} className="goal-form-grid">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    placeholder="Título"
                    required
                  />

                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    placeholder="Descrição"
                    rows={4}
                  />

                  <div className="goal-form-inline">
                    <label>
                      Prazo
                      <input
                        type="date"
                        value={formData.deadline}
                        onChange={(event) => setFormData({ ...formData, deadline: event.target.value })}
                      />
                    </label>
                    <label>
                      Dificuldade
                      <select
                        value={formData.difficulty}
                        onChange={(event) => setFormData({ ...formData, difficulty: Number(event.target.value) })}
                      >
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label>
                      Modo
                      <select
                        value={formData.goal_mode}
                        onChange={(event) => setFormData({ ...formData, goal_mode: event.target.value })}
                      >
                        <option value="simple">Meta simples</option>
                        <option value="milestones">Meta com etapas</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Foto (opcional)
                    <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
                  </label>

                  {formData.goal_mode === 'milestones' && (
                    <div className="goal-milestone-editor">
                      <div className="goal-milestone-editor-head">
                        <h4>Etapas</h4>
                        <button type="button" className="btn btn-secondary" onClick={handleAddMilestone}>
                          <Plus size={16} /> Adicionar etapa
                        </button>
                      </div>

                      {formData.milestones.length === 0 ? (
                        <p className="goal-helper-text">Esta meta ficará fragmentada quando você adicionar as etapas.</p>
                      ) : (
                        formData.milestones.map((milestone, index) => (
                          <div key={`${milestone.id || 'new'}-${index}`} className="milestone-draft-card">
                            <input
                              type="text"
                              value={milestone.title}
                              onChange={(event) => handleUpdateMilestoneDraft(index, 'title', event.target.value)}
                              placeholder={`Etapa ${index + 1}`}
                            />
                            <textarea
                              rows={2}
                              value={milestone.description || ''}
                              onChange={(event) => handleUpdateMilestoneDraft(index, 'description', event.target.value)}
                              placeholder="Descrição da etapa"
                            />
                            <button type="button" className="btn btn-danger" onClick={() => handleRemoveMilestoneDraft(index)}>
                              <Trash2 size={16} /> Remover
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={resetGoalForm}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">{editingGoalId ? 'Salvar meta' : 'Criar meta'}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="goals-list">
              {!showGoalForm && goals.length === 0 && <div className="card empty">Nenhuma meta nesta categoria.</div>}

              {goals.map((goal) => (
                <article key={goal.id} className={`card goal-card ${goal.status === 'concluida' ? 'goal-completed' : 'goal-active'}`}>
                  <div className="goal-card-media">
                    {goal.image_path ? <img src={resolveMediaUrl(goal.image_path)} alt={goal.title} className="goal-thumb" /> : <div className="thumb-box">-</div>}
                  </div>

                  <div className="goal-card-body">
                    <div className="goal-title-row">
                      <div>
                        <h3 className="goal-title">{goal.title}</h3>
                        <p className="goal-desc">{goal.description || 'Sem descrição.'}</p>
                      </div>
                      <div className="goal-card-badges">
                        <span className="goal-mode-badge">{goal.goal_mode === 'milestones' ? 'Etapas' : 'Simples'}</span>
                        <span className="goal-stars-badge"><Star size={16} /> {goal.difficulty}</span>
                      </div>
                    </div>

                    <div className="goal-meta-line">
                      <span><Target size={14} /> {goal.progress_snapshot?.summary || goal.progress}</span>
                      {goal.deadline && <span><Flag size={14} /> {new Date(goal.deadline).toLocaleDateString('pt-BR')}</span>}
                      {goal.status === 'concluida' && goal.completed_at && <span><CheckCircle2 size={14} /> {new Date(goal.completed_at).toLocaleDateString('pt-BR')}</span>}
                    </div>

                    {goal.goal_mode === 'milestones' && goal.milestones?.length > 0 && (
                      <div className="goal-milestones-list">
                        {goal.milestones.map((milestone) => (
                          <button
                            type="button"
                            key={milestone.id}
                            className={`goal-milestone-chip ${milestone.is_completed ? 'done' : ''}`}
                            onClick={() => goal.status !== 'concluida' && handleToggleMilestoneStatus(milestone.id, milestone.is_completed)}
                          >
                            {milestone.is_completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            <span>{milestone.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="goal-actions-inline">
                    {goal.status !== 'concluida' && (
                      <>
                        <button className="btn btn-secondary" onClick={() => handleEditGoal(goal)}>Editar</button>
                        <button className="btn btn-primary" onClick={() => handleConcludeGoal(goal.id)}>Concluir</button>
                      </>
                    )}
                    <button className="btn btn-danger" onClick={() => handleDeleteGoal(goal.id)}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Goals;
