import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  PencilLine,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import { goalsApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './Goals.css';

const initialGoalForm = {
  title: '',
  description: '',
  deadline: '',
  difficulty: 1,
  notifications_enabled: true,
  goal_mode: 'simple',
  milestones: [],
};

const emptyMilestone = () => ({ title: '', description: '', is_completed: false });

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
};

const getProgressSummary = (goal, uiMode = 'view') => {
  const summary = goal?.progress_snapshot?.summary || goal?.progress || 'Sem progresso ainda';

  if (uiMode === 'view' && summary === 'Meta simples sem atividades vinculadas') {
    return '';
  }

  return summary;
};

const shouldShowProgressMeta = (goal, uiMode = 'view') => goal?.status !== 'concluida' && Boolean(getProgressSummary(goal, uiMode));

const goalMatchesSearch = (goal, query) => {
  const haystack = [goal.title, goal.description, goal?.progress_snapshot?.summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export default function Goals() {
  const [sectionMode, setSectionMode] = useState('summary');
  const [uiMode, setUiMode] = useState('view');
  const [home, setHome] = useState({ total_stars: 0, recent_achievements: [], categories_overview: [] });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [formData, setFormData] = useState(initialGoalForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (sectionMode === 'category' && selectedCategory) {
      loadGoalsByCategory(selectedCategory.id);
    }
  }, [sectionMode, selectedCategory]);

  const categoryOverviewMap = useMemo(
    () => new Map((home.categories_overview || []).map((item) => [item.id, item])),
    [home.categories_overview]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.name.toLowerCase().includes(normalizedQuery)),
    [categories, normalizedQuery]
  );

  const filteredRecentGoals = useMemo(
    () => (home.recent_achievements || []).filter((goal) => goalMatchesSearch(goal, normalizedQuery || '')),
    [home.recent_achievements, normalizedQuery]
  );

  const filteredGoals = useMemo(
    () => goals.filter((goal) => goalMatchesSearch(goal, normalizedQuery || '')),
    [goals, normalizedQuery]
  );

  const activeGoals = useMemo(
    () => filteredGoals.filter((goal) => goal.status !== 'concluida'),
    [filteredGoals]
  );

  const completedGoals = useMemo(
    () => filteredGoals.filter((goal) => goal.status === 'concluida'),
    [filteredGoals]
  );

  const orderedGoals = useMemo(() => [...activeGoals, ...completedGoals], [activeGoals, completedGoals]);

  const overallProgress = useMemo(() => {
    return filteredCategories.reduce((acc, category) => {
      const overview = categoryOverviewMap.get(category.id) || {};
      acc.total += overview.total || 0;
      acc.completed += overview.completed || 0;
      return acc;
    }, { total: 0, completed: 0 });
  }, [filteredCategories, categoryOverviewMap]);

  const overallProgressPercentage = overallProgress.total
    ? Math.round((overallProgress.completed / overallProgress.total) * 100)
    : 0;

  async function loadSummary() {
    setLoading(true);
    try {
      const [homeResponse, categoriesResponse] = await Promise.all([
        goalsApi.getHome(),
        goalsApi.listCategories(),
      ]);
      setHome(homeResponse.data.data || { total_stars: 0, recent_achievements: [], categories_overview: [] });
      setCategories(categoriesResponse.data.data || []);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar metas.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadGoalsByCategory(categoryId) {
    setLoading(true);
    try {
      const response = await goalsApi.listByCategory(categoryId);
      setGoals(response.data.data || []);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar a categoria.' });
    } finally {
      setLoading(false);
    }
  }

  const resetGoalForm = () => {
    setFormData(initialGoalForm);
    setPhotoFile(null);
    setEditingGoalId(null);
    setShowGoalForm(false);
  };

  const openGoalForm = (goal = null) => {
    if (!goal) {
      setEditingGoalId(null);
      setFormData(initialGoalForm);
      setPhotoFile(null);
      setShowGoalForm(true);
      return;
    }

    setEditingGoalId(goal.id);
    setFormData({
      title: goal.title || '',
      description: goal.description || '',
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      difficulty: goal.difficulty || 1,
      notifications_enabled: goal.notifications_enabled !== false,
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

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setSectionMode('category');
    setSearchQuery('');
    resetGoalForm();
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await goalsApi.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      await loadSummary();
      setFeedback({ type: 'success', message: 'Categoria criada.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao criar categoria.' });
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory) return;
    const nextName = window.prompt('Novo nome da categoria:', selectedCategory.name);
    if (!nextName?.trim()) return;

    try {
      await goalsApi.updateCategory(selectedCategory.id, { name: nextName.trim() });
      await loadSummary();
      setSelectedCategory((prev) => (prev ? { ...prev, name: nextName.trim() } : prev));
      setFeedback({ type: 'success', message: 'Categoria atualizada.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao editar categoria.' });
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory || !window.confirm(`Excluir a categoria "${selectedCategory.name}" e suas metas?`)) return;

    try {
      await goalsApi.removeCategory(selectedCategory.id);
      setSelectedCategory(null);
      setSectionMode('summary');
      await loadSummary();
      setFeedback({ type: 'success', message: 'Categoria excluída.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao excluir categoria.' });
    }
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
        notifications_enabled: formData.notifications_enabled,
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
        await goalsApi.syncMilestones(
          goalId,
          formData.milestones
            .filter((item) => item.title.trim())
            .map((item, index) => ({ ...item, sort_order: index }))
        );
      }

      if (goalId && formData.goal_mode === 'simple' && editingGoalId) {
        await goalsApi.syncMilestones(goalId, []);
      }

      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      resetGoalForm();
      setFeedback({ type: 'success', message: editingGoalId ? 'Meta atualizada.' : 'Meta criada.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar meta.' });
    }
  };

  const handleConcludeGoal = async (goalId) => {
    try {
      await goalsApi.updateStatus(goalId, 'concluida');
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      setFeedback({ type: '', message: '' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao concluir meta.' });
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Excluir esta meta?')) return;

    try {
      await goalsApi.remove(goalId);
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
      setFeedback({ type: 'success', message: 'Meta excluída.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao excluir meta.' });
    }
  };

  const handleToggleMilestone = async (milestone) => {
    try {
      await goalsApi.updateMilestoneStatus(milestone.id, !milestone.is_completed);
      await loadGoalsByCategory(selectedCategory.id);
      await loadSummary();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao atualizar etapa.' });
    }
  };

  if (loading) {
    return (
      <div className="goals-page">
        <div className="goals-shell page-shell">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="goals-page">
      <aside className="goals-sidebar page-shell">
        <button
          type="button"
          className={`goals-sidebar__item ${sectionMode === 'summary' ? 'active' : ''}`}
          onClick={() => {
            setSectionMode('summary');
            setSelectedCategory(null);
            setSearchQuery('');
            resetGoalForm();
            loadSummary();
          }}
        >
          <span>Sumário</span>
        </button>

        {categories.map((category) => {
          const overview = categoryOverviewMap.get(category.id) || {};
          return (
            <button
              key={category.id}
              type="button"
              className={`goals-sidebar__item ${selectedCategory?.id === category.id ? 'active' : ''}`}
              onClick={() => handleSelectCategory(category)}
            >
              <span>{category.name}</span>
              <small>{overview.total || 0}</small>
            </button>
          );
        })}
      </aside>

      <section className="goals-shell page-shell">
        {feedback.message ? <div className={`goals-feedback ${feedback.type}`}>{feedback.message}</div> : null}

        <header className="goals-topbar">
          <div className="goals-topbar__filler" />

          <div className="goals-points-shell">
            <span className="goals-kicker">Goal Points</span>
            <strong>{home.total_stars || 0}</strong>
          </div>

          <div className="goals-topbar__actions">
            <label className="goals-search-shell">
              <Search size={15} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar"
              />
            </label>

            <div className="goals-mode-toggle">
              <button type="button" className={uiMode === 'view' ? 'active' : ''} onClick={() => setUiMode('view')}>
                Exibição
              </button>
              <button type="button" className={uiMode === 'edit' ? 'active' : ''} onClick={() => setUiMode('edit')}>
                Edição
              </button>
            </div>
          </div>
        </header>

        {sectionMode === 'summary' ? (
          <div className="goals-overview">
            <section className="goals-panel">
              <div className="goals-panel__head">
                <h2>Metas recentes</h2>
              </div>

              <div className="goal-achievement-list">
                {filteredRecentGoals.length ? filteredRecentGoals.map((goal) => (
                  <article key={goal.id} className={`goal-achievement-row is-complete ${goal.goal_mode === 'milestones' ? 'is-composite' : 'is-simple'}`}>
                    <div className="goal-achievement-row__icon">
                      {goal.image_path ? (
                        <img src={resolveMediaUrl(goal.image_path)} alt={goal.title} />
                      ) : (
                        <Star size={16} />
                      )}
                    </div>

                    <div className="goal-achievement-row__body">
                      <div className={`goal-achievement-row__titlebar ${goal.goal_mode === 'milestones' ? 'is-composite' : 'is-simple'}`}>
                        <h3>{goal.title}</h3>
                      </div>
                      {goal.description ? <p>{goal.description}</p> : null}
                    </div>

                    <div className="goal-achievement-row__aside">
                      <div className="goal-points-badge">
                        <Star size={28} className="goal-points-badge__star" />
                        <span className="goal-points-badge__value">{goal.difficulty || 1}</span>
                      </div>
                      <small>{formatDate(goal.completed_at)}</small>
                    </div>
                  </article>
                )) : (
                  <div className="goals-empty-inline">Nenhuma meta criada ainda.</div>
                )}
              </div>
            </section>

            <section className="goals-panel">
              <div className="goals-panel__head">
                <h2>Visão de progresso</h2>
              </div>

              <div className="goals-overview-earned">
                <div className="goals-overview-earned__head">
                  <span className="goals-overview-earned__title">Metas concluídas</span>
                  <strong>{overallProgress.completed}/{overallProgress.total || 0}</strong>
                </div>
                <div className="goals-overview-earned__bar">
                  <div style={{ width: `${overallProgressPercentage}%` }} />
                </div>
              </div>

              <div className="goals-overview-grid">
                {filteredCategories.length ? filteredCategories.map((category) => {
                  const overview = categoryOverviewMap.get(category.id) || {};
                  const total = overview.total || 0;
                  const completed = overview.completed || 0;
                  const percentage = total ? Math.round((completed / total) * 100) : 0;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`goals-overview-chip ${total > 0 && completed === total ? 'is-complete' : ''}`}
                      onClick={() => handleSelectCategory(category)}
                    >
                      <span>{category.name}</span>
                      <strong>{completed}/{total || 0}</strong>
                      <div className="goals-overview-chip__bar">
                        <div style={{ width: `${percentage}%` }} />
                      </div>
                    </button>
                  );
                }) : (
                  <div className="goals-empty-inline">Nenhuma categoria criada ainda.</div>
                )}
              </div>

              {uiMode === 'edit' ? (
                <div className="goals-category-creator">
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Nova categoria"
                  />
                  <button className="btn btn-primary" onClick={handleCreateCategory}>
                    <Plus size={16} /> Criar
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="goals-category-view">
            <section className="goals-panel">

              {uiMode === 'edit' ? (
                <div className="goals-category-actions">
                  <button className="btn btn-primary" onClick={() => openGoalForm()}>
                    <Plus size={16} /> Nova meta
                  </button>
                  <button className="btn btn-secondary" onClick={handleEditCategory}>Editar categoria</button>
                  <button className="btn btn-danger" onClick={handleDeleteCategory}>Excluir categoria</button>
                </div>
              ) : null}

              {showGoalForm && uiMode === 'edit' ? (
                <form onSubmit={handleSubmitGoal} className="goal-form">
                  <input
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    placeholder="Título"
                    required
                  />

                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    placeholder="Descrição"
                  />

                  <div className="goal-form__row">
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(event) => setFormData({ ...formData, deadline: event.target.value })}
                    />

                    <select
                      value={formData.difficulty}
                      onChange={(event) => setFormData({ ...formData, difficulty: Number(event.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}★</option>)}
                    </select>

                    <select
                      value={formData.goal_mode}
                      onChange={(event) => setFormData({ ...formData, goal_mode: event.target.value })}
                    >
                      <option value="simple">Meta simples</option>
                      <option value="milestones">Meta com etapas</option>
                    </select>
                  </div>

                  <label className="goal-form__toggle">
                    <span>Notificar esta meta</span>
                    <input
                      type="checkbox"
                      checked={formData.notifications_enabled}
                      onChange={(event) => setFormData({ ...formData, notifications_enabled: event.target.checked })}
                    />
                  </label>

                  <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />

                  {formData.goal_mode === 'milestones' ? (
                    <div className="goal-milestone-editor">
                      <div className="goals-panel__subhead">
                        <h3>Etapas</h3>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setFormData((prev) => ({ ...prev, milestones: [...prev.milestones, emptyMilestone()] }))}
                        >
                          <Plus size={16} /> Etapa
                        </button>
                      </div>

                      {formData.milestones.length ? formData.milestones.map((milestone, index) => (
                        <div key={`${milestone.id || 'new'}-${index}`} className="goal-milestone-draft">
                          <input
                            value={milestone.title}
                            onChange={(event) => setFormData((prev) => ({
                              ...prev,
                              milestones: prev.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item),
                            }))}
                            placeholder={`Etapa ${index + 1}`}
                          />

                          <textarea
                            rows={2}
                            value={milestone.description || ''}
                            onChange={(event) => setFormData((prev) => ({
                              ...prev,
                              milestones: prev.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item),
                            }))}
                            placeholder="Descrição da etapa"
                          />

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setFormData((prev) => ({
                              ...prev,
                              milestones: prev.milestones.filter((_, itemIndex) => itemIndex !== index),
                            }))}
                          >
                            <Trash2 size={16} /> Remover
                          </button>
                        </div>
                      )) : (
                        <div className="goals-empty-inline">Adicione etapas para fragmentar a meta.</div>
                      )}
                    </div>
                  ) : null}

                  <div className="goal-form__actions">
                    <button type="button" className="btn btn-secondary" onClick={resetGoalForm}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">{editingGoalId ? 'Salvar meta' : 'Criar meta'}</button>
                  </div>
                </form>
              ) : null}

              <div className="goal-achievement-list">
                {orderedGoals.length ? orderedGoals.map((goal) => (
                  <article key={goal.id} className={`goal-achievement-row ${goal.status === 'concluida' ? 'is-complete' : 'is-active'} ${goal.goal_mode === 'milestones' ? 'is-composite' : 'is-simple'}`}>
                    <div className="goal-achievement-row__icon">
                      {goal.image_path ? (
                        <img src={resolveMediaUrl(goal.image_path)} alt={goal.title} />
                      ) : goal.status === 'concluida' ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Circle size={16} />
                      )}
                    </div>

                    <div className="goal-achievement-row__body">
                      <div className={`goal-achievement-row__titlebar ${goal.goal_mode === 'milestones' ? 'is-composite' : 'is-simple'}`}>
                        <h3>{goal.title}</h3>
                      </div>
                      {goal.description ? <p>{goal.description}</p> : null}
                      {shouldShowProgressMeta(goal, uiMode) || (goal.deadline && goal.status !== 'concluida') ? (
                        <div className="goal-achievement-row__meta">
                          {shouldShowProgressMeta(goal, uiMode) ? <span><Target size={14} /> {getProgressSummary(goal, uiMode)}</span> : null}
                          {goal.deadline && goal.status !== 'concluida' ? <span><Flag size={14} /> {formatDate(goal.deadline)}</span> : null}
                        </div>
                      ) : null}

                      {goal.goal_mode === 'milestones' && goal.milestones?.length ? (
                        <div className="goal-achievement-row__milestones">
                          {goal.milestones.map((milestone) => (
                            <button
                              key={milestone.id}
                              type="button"
                              className={`goal-milestone-chip ${milestone.is_completed ? 'done' : ''}`}
                              onClick={() => goal.status !== 'concluida' && handleToggleMilestone(milestone)}
                            >
                              {milestone.is_completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                              <span>{milestone.title}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="goal-achievement-row__aside">
                      <div className="goal-points-badge">
                        <Star size={28} className="goal-points-badge__star" />
                        <span className="goal-points-badge__value">{goal.difficulty}</span>
                      </div>
                      <small>{goal.status === 'concluida' ? formatDate(goal.completed_at) : (goal.deadline ? formatDate(goal.deadline) : '')}</small>
                    </div>

                    {uiMode === 'edit' || goal.status !== 'concluida' ? (
                      <div className="goal-achievement-row__actions">
                        {goal.status !== 'concluida' ? (
                          <>
                            {uiMode === 'edit' ? (
                              <button className="goal-icon-btn" onClick={() => openGoalForm(goal)}><PencilLine size={15} /></button>
                            ) : null}
                            <button className="goal-icon-btn goal-icon-btn--primary" onClick={() => handleConcludeGoal(goal.id)}><CheckCircle2 size={15} /></button>
                          </>
                        ) : null}
                        {uiMode === 'edit' ? (
                          <button className="goal-icon-btn goal-icon-btn--danger" onClick={() => handleDeleteGoal(goal.id)}><Trash2 size={15} /></button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )) : (
                  <div className="goals-empty-inline">Nenhuma meta criada nesta categoria.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
