// src/pages/Goals.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Star as StarIcon } from 'lucide-react';
import { goalsApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './Goals.css';


const initialFormState = {
  title: '',
  description: '',
  hasDeadline: false,
  deadline: '',
  difficulty: 1,
};




const Star = ({ filled, onClick, size = 18, value }) => (
  <button
    type="button"
    className={`star-btn ${filled ? 'filled' : ''}`}
    onClick={onClick}
    aria-label={`Selecionar ${value} estrela${value > 1 ? 's' : ''}`}
    aria-pressed={filled}
  >
    <StarIcon size={size} />
  </button>
);

const Goals = () => {
  const [mode, setMode] = useState('summary'); // 'summary' | 'category'
  const [home, setHome] = useState({ total_stars: 0, recent_achievements: [], categories_overview: [] });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');

  // Goal form (used in category view)
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState({ type: '', message: '' });
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [isSubmittingCategoryEdit, setIsSubmittingCategoryEdit] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);
  const [deleteCategoryConfirmationName, setDeleteCategoryConfirmationName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [pendingDeleteGoalId, setPendingDeleteGoalId] = useState(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [isConcludingGoalId, setIsConcludingGoalId] = useState(null);
  const categoryEditInputRef = useRef(null);
  const deleteCategoryCancelRef = useRef(null);
  const deleteGoalCancelRef = useRef(null);

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
      const homeResp = await goalsApi.getHome();
      setHome(homeResp?.data?.data || { total_stars: 0, recent_achievements: [], categories_overview: [] });

      const catResp = await goalsApi.listCategories();
      setCategories(catResp?.data?.data || []);
    } catch (err) {
      console.error('Erro carregando summary:', err);
      setHome({ total_stars: 0, recent_achievements: [], categories_overview: [] });
      setCategories([]);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o resumo de metas.' });
    } finally {
      setLoading(false);
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
      setFeedback({ type: 'error', message: 'Não foi possível carregar as metas da categoria.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editingCategory && categoryEditInputRef.current) {
      categoryEditInputRef.current.focus();
    }
  }, [editingCategory]);

  useEffect(() => {
    if (pendingDeleteCategory && deleteCategoryCancelRef.current) {
      deleteCategoryCancelRef.current.focus();
    }
  }, [pendingDeleteCategory]);

  useEffect(() => {
    if (pendingDeleteGoalId && deleteGoalCancelRef.current) {
      deleteGoalCancelRef.current.focus();
    }
  }, [pendingDeleteGoalId]);

const handleCreateCategory = async () => {
  if (!newCategoryName.trim()) {
    setFeedback({ type: 'error', message: 'Nome da categoria é obrigatório.' });
    return;
  }

  setIsSubmittingCategory(true);
  setFeedback({ type: '', message: '' });
  try {
    await goalsApi.createCategory({ name: newCategoryName.trim() });
    setNewCategoryName('');
    setFeedback({ type: 'success', message: 'Categoria criada com sucesso.' });
    await loadSummary();
  } catch (err) {
    console.error('Erro ao criar categoria', err);
    const msg = err?.response?.data?.detail || 'Erro ao criar categoria';
    setFeedback({ type: 'error', message: msg });
  } finally {
    setIsSubmittingCategory(false);
  }
};

const handleEditCategory = async (category) => {
  if (!category) return;
  setEditingCategory(category);
  setEditingCategoryName(category.name || '');
};

const handleSubmitEditCategory = async (e) => {
  e.preventDefault();
  if (!editingCategory) return;
  if (!editingCategoryName.trim()) {
    setFeedback({ type: 'error', message: 'Informe um nome válido para a categoria.' });
    return;
  }

  setIsSubmittingCategoryEdit(true);
  setFeedback({ type: '', message: '' });
  try {
    await goalsApi.updateCategory(editingCategory.id, { name: editingCategoryName.trim() });

    const catResp = await goalsApi.listCategories();
    const updatedCategories = catResp?.data?.data || [];
    setCategories(updatedCategories);

    if (selectedCategory?.id === editingCategory.id) {
      const updated = updatedCategories.find(c => c.id === editingCategory.id);
      setSelectedCategory(updated || null);
    }

    setEditingCategory(null);
    setEditingCategoryName('');
    setFeedback({ type: 'success', message: 'Categoria editada com sucesso.' });

  } catch (err) {
    console.error('Erro ao editar categoria', err);
    setFeedback({ type: 'error', message: 'Erro ao editar categoria.' });
  } finally {
    setIsSubmittingCategoryEdit(false);
  }
};

const handleDeleteCategory = async (categoryId) => {
  setIsDeletingCategory(true);
  setFeedback({ type: '', message: '' });
  try {
    await goalsApi.removeCategory(categoryId);

    const catResp = await goalsApi.listCategories();
    const updatedCategories = catResp?.data?.data || [];
    setCategories(updatedCategories);

    if (selectedCategory?.id === categoryId) {
      setSelectedCategory(null);
      setMode('summary');
    }

    setPendingDeleteCategory(null);
    setDeleteCategoryConfirmationName('');
    setFeedback({ type: 'success', message: 'Categoria excluída com sucesso.' });

  } catch (err) {
    console.error('Erro ao excluir categoria', err);
    setFeedback({ type: 'error', message: 'Erro ao excluir categoria.' });
  } finally {
    setIsDeletingCategory(false);
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

    if (formData.hasDeadline && formData.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(formData.deadline)) {
      setUploadFeedback({
        type: 'error',
        message: 'Use o formato YYYY-MM-DD (ano com 4 dígitos).',
      });
      return;
    }

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
      setFeedback({ type: 'error', message: msg });
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
    setIsDeletingGoal(true);
    setFeedback({ type: '', message: '' });
    try {
      await goalsApi.remove(goalId);
      if (selectedCategory) await loadGoalsByCategory(selectedCategory.id);
      else await loadSummary();
      setFeedback({ type: 'success', message: 'Meta excluída com sucesso.' });
      setPendingDeleteGoalId(null);
    } catch (err) {
      console.error('Erro ao deletar meta', err);
      setFeedback({ type: 'error', message: 'Erro ao deletar meta.' });
    } finally {
      setIsDeletingGoal(false);
    }
  };

  const handleConcludeGoal = async (goalId) => {
    setIsConcludingGoalId(goalId);
    setFeedback({ type: '', message: '' });
    try {
      await goalsApi.updateStatus(goalId, 'concluida');
      if (mode === 'category' && selectedCategory) await loadGoalsByCategory(selectedCategory.id);
      else await loadSummary();
      setFeedback({ type: 'success', message: 'Meta concluída com sucesso.' });
    } catch (err) {
      console.error('Erro ao concluir meta', err);
      setFeedback({ type: 'error', message: 'Erro ao concluir meta.' });
    } finally {
      setIsConcludingGoalId(null);
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
        {feedback.message ? <div className={`upload-feedback ${feedback.type}`}>{feedback.message}</div> : null}
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
      <button className="btn" onClick={handleCreateCategory} disabled={isSubmittingCategory}>
        {isSubmittingCategory ? 'Criando...' : 'Criar categoria'}
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
  disabled={isSubmittingCategoryEdit}
>
  Editar Categoria
</button>


      <button
        className="btn btn-danger"
        onClick={() => setPendingDeleteCategory(selectedCategory)}
        disabled={isDeletingCategory}
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
            <div className="goal-category-header">
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
                            <Star
                              key={v}
                              value={v}
                              filled={v <= (formData.difficulty || 1)}
                              onClick={() => setDifficulty(v)}
                            />
                          ))}
                          <span className="stars-selected-count">{formData.difficulty || 1}/5</span>
                        </div>
                      </div>

                      <div className="form-row">
                        <label>Prazo (opcional)</label>
                        <input
                          type="text"
                          value={formData.deadline}
                          onChange={(e) => {
                            const normalizedValue = e.target.value.replace(/[^\d-]/g, '').slice(0, 10);
                            setFormData({
                              ...formData,
                              deadline: normalizedValue,
                              hasDeadline: !!normalizedValue,
                            });
                          }}
                          inputMode="numeric"
                          maxLength={10}
                          pattern="\d{4}-\d{2}-\d{2}"
                          placeholder="YYYY-MM-DD"
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
{console.log("GOALS ARRAY:", goals)}
                {goals.map((goal) => (
<div
  key={goal.id}
  className={`card goal-card ${
    goal.status === 'concluida'
      ? 'goal-completed'
      : 'goal-active'
  }`}
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

  {goal.description && (
    <div className="goal-desc">{goal.description}</div>
  )}

  {goal.status === 'concluida' && goal.completed_at && (
    <div className="goal-date">
      Concluída em {new Date(goal.completed_at).toLocaleString('pt-BR')}
    </div>
  )}
</div>

<div className="goal-right">

  {goal.status === 'concluida' && (
    <svg
      className="goal-check"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17L4 12" />
    </svg>
  )}

  <div className="goal-stars-badge">
    <StarIcon size={42} className="goal-star-icon" />
    <span className="goal-star-number">{goal.difficulty}</span>
  </div>
</div>

<div className="goal-actions">
  {goal.status !== 'concluida' && (
    <>
      <button className="goal-icon-btn" onClick={() => handleConcludeGoal(goal.id)} disabled={isConcludingGoalId === goal.id}>
        ✅
      </button>

      <button className="goal-icon-btn" onClick={() => handleEditGoal(goal)}>
        ✏️
      </button>
    </>
  )}

  <button className="goal-icon-btn delete-btn" onClick={() => setPendingDeleteGoalId(goal.id)} disabled={isDeletingGoal}>
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

      {editingCategory && (
        <div className="modal-backdrop" onClick={() => !isSubmittingCategoryEdit && setEditingCategory(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-category-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-category-title">Editar categoria</h2>
            <form onSubmit={handleSubmitEditCategory} className="modal-form">
              <input ref={categoryEditInputRef} className="input" value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} required />
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditingCategory(null)} disabled={isSubmittingCategoryEdit}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingCategoryEdit}>
                  {isSubmittingCategoryEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteCategory && (
        <div className="modal-backdrop" onClick={() => !isDeletingCategory && setPendingDeleteCategory(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-category-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-category-title">Excluir categoria</h2>
            <p>Digite o nome da categoria <strong>{pendingDeleteCategory.name}</strong> para confirmar:</p>
            <input className="input" value={deleteCategoryConfirmationName} onChange={(e) => setDeleteCategoryConfirmationName(e.target.value)} />
            <div className="modal-actions">
              <button ref={deleteCategoryCancelRef} type="button" className="btn" onClick={() => setPendingDeleteCategory(null)} disabled={isDeletingCategory}>Cancelar</button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeletingCategory || deleteCategoryConfirmationName !== pendingDeleteCategory.name}
                onClick={() => handleDeleteCategory(pendingDeleteCategory.id)}
              >
                {isDeletingCategory ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteGoalId && (
        <div className="modal-backdrop" onClick={() => !isDeletingGoal && setPendingDeleteGoalId(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-goal-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-goal-title">Excluir meta</h2>
            <p>Tem certeza que deseja deletar esta meta?</p>
            <div className="modal-actions">
              <button ref={deleteGoalCancelRef} type="button" className="btn" onClick={() => setPendingDeleteGoalId(null)} disabled={isDeletingGoal}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => handleDeleteGoal(pendingDeleteGoalId)} disabled={isDeletingGoal}>
                {isDeletingGoal ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
