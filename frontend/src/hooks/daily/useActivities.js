import { useState } from "react";
import { activitiesApi } from "../../services/api";
import { DEFAULT_ACTIVITY } from "./constants";
import { createUiState } from "./utils";

export function useActivities() {
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState(DEFAULT_ACTIVITY);
  const [validationErrors, setValidationErrors] = useState({});
  const [state, setState] = useState(createUiState());

  const validateActivity = activity => {
    const errors = {};
    const title = (activity.title || "").trim();

    if (!title) {
      errors.title = "Título é obrigatório.";
    }

    if (activity.min_duration <= 0) {
      errors.min_duration = "A duração mínima deve ser maior que zero.";
    }

    if (activity.max_duration <= 0) {
      errors.max_duration = "A duração máxima deve ser maior que zero.";
    }

    if (activity.max_duration < activity.min_duration) {
      errors.max_duration = "A duração máxima deve ser maior ou igual à mínima.";
    }

    const hasFixedTime = Boolean(activity.fixed_time);
    const fixedDurationValue =
      activity.fixed_duration === "" || activity.fixed_duration === null || activity.fixed_duration === undefined
        ? null
        : Number(activity.fixed_duration);
    const hasFixedDuration = Number.isFinite(fixedDurationValue);

    if (hasFixedTime !== hasFixedDuration) {
      errors.fixed_time = "Defina horário e duração fixos juntos, ou deixe ambos em branco.";
      errors.fixed_duration = "Defina horário e duração fixos juntos, ou deixe ambos em branco.";
    }

    if (hasFixedDuration && fixedDurationValue <= 0) {
      errors.fixed_duration = "A duração fixa deve ser maior que zero.";
    }

    if (!activity.is_disc && !activity.is_fun) {
      errors.category = "Marque pelo menos uma categoria.";
    }

    return errors;
  };

  const fetchActivities = async () => {
    setState(createUiState("loading"));
    try {
      const res = await activitiesApi.list();
      if (res.data.success) {
        setActivities(res.data.data);
        setShowActivitiesModal(true);
      }
      setState(createUiState("success"));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível carregar as atividades."));
    }
  };

  const createActivity = async () => {
    const errors = validateActivity(newActivity);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setState(createUiState("error", "Corrija os campos destacados antes de continuar."));
      return;
    }

    setValidationErrors({});
    setState(createUiState("loading"));
    try {
      const payload = {
        ...newActivity,
        title: newActivity.title.trim(),
        fixed_time: newActivity.fixed_time || null,
        fixed_duration:
          newActivity.fixed_duration === "" || newActivity.fixed_duration === null || newActivity.fixed_duration === undefined
            ? null
            : Number(newActivity.fixed_duration)
      };
      await activitiesApi.create(payload);
      setNewActivity(DEFAULT_ACTIVITY);
      setValidationErrors({});
      await fetchActivities();
      setState(createUiState("success", null, "Atividade criada com sucesso."));
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setState(createUiState("error", detail || "Não foi possível criar a atividade."));
    }
  };

  const toggleActivity = async id => {
    setState(createUiState("loading"));
    try {
      await activitiesApi.toggle(id);
      await fetchActivities();
      setState(createUiState("success", null, "Status da atividade atualizado."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível alterar o status da atividade."));
    }
  };

  const deleteActivity = async id => {
    setState(createUiState("loading"));
    try {
      await activitiesApi.remove(id);
      await fetchActivities();
      setState(createUiState("success", null, "Atividade excluída com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível excluir a atividade."));
    }
  };

  const handleFrequencyChange = frequencyType => {
    setNewActivity(prev => ({ ...prev, frequency_type: frequencyType }));
  };

  return {
    showActivitiesModal,
    setShowActivitiesModal,
    activities,
    newActivity,
    setNewActivity,
    validationErrors,
    state,
    fetchActivities,
    createActivity,
    toggleActivity,
    deleteActivity,
    handleFrequencyChange,
    clearState: () => setState(createUiState())
  };
}
