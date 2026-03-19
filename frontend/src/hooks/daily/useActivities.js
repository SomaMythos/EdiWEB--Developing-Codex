import { useState } from "react";
import { activitiesApi } from "../../services/api";
import { DEFAULT_ACTIVITY } from "./constants";
import { createUiState, usesNeutralActivityCategory } from "./utils";

export function useActivities() {
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState(DEFAULT_ACTIVITY);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [state, setState] = useState(createUiState());

  const resetActivityForm = () => {
    setNewActivity(DEFAULT_ACTIVITY);
    setEditingActivityId(null);
    setValidationErrors({});
  };

  const mapActivityToForm = activity => ({
    title: activity?.title || "",
    min_duration: Number(activity?.min_duration) || 0,
    max_duration: Number(activity?.max_duration) || 0,
    frequency_type: activity?.frequency_type || "flex",
    intercalate_days: activity?.intercalate_days ?? "",
    fixed_time: activity?.fixed_time || "",
    fixed_duration: activity?.fixed_duration ?? "",
    is_disc: Boolean(activity?.is_disc),
    is_fun: Boolean(activity?.is_fun)
  });

  const validateActivity = activity => {
    const errors = {};
    const title = (activity.title || "").trim();
    const usesNeutralCategory = usesNeutralActivityCategory(activity);

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
    const intercalateDaysValue =
      activity.intercalate_days === "" || activity.intercalate_days === null || activity.intercalate_days === undefined
        ? null
        : Number(activity.intercalate_days);

    if (hasFixedTime !== hasFixedDuration) {
      errors.fixed_time = "Defina horário e duração fixos juntos, ou deixe ambos em branco.";
      errors.fixed_duration = "Defina horário e duração fixos juntos, ou deixe ambos em branco.";
    }

    if (hasFixedDuration && fixedDurationValue <= 0) {
      errors.fixed_duration = "A duração fixa deve ser maior que zero.";
    }

    if (!usesNeutralCategory && !activity.is_disc && !activity.is_fun) {
      errors.category = "Marque pelo menos uma categoria.";
    }

    if (activity.frequency_type === "intercalate") {
      if (!Number.isFinite(intercalateDaysValue)) {
        errors.intercalate_days = "Defina os dias minimos para repetir a atividade.";
      } else if (intercalateDaysValue <= 0) {
        errors.intercalate_days = "Os dias minimos devem ser maiores que zero.";
      }
    }

    return errors;
  };

  const normalizeActivityPayload = activity => ({
    ...activity,
    is_disc: usesNeutralActivityCategory(activity) ? false : Boolean(activity.is_disc),
    is_fun: usesNeutralActivityCategory(activity) ? false : Boolean(activity.is_fun)
  });

  const fetchActivities = async () => {
    setState(createUiState("loading"));
    try {
      const res = await activitiesApi.list();
      if (res.data.success) {
        setActivities(Array.isArray(res.data.data) ? res.data.data : []);
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
      const payload = normalizeActivityPayload({
        ...newActivity,
        title: newActivity.title.trim(),
        intercalate_days:
          newActivity.frequency_type === "intercalate"
            ? Number(newActivity.intercalate_days)
            : null,
        fixed_time: newActivity.fixed_time || null,
        fixed_duration:
          newActivity.fixed_duration === "" || newActivity.fixed_duration === null || newActivity.fixed_duration === undefined
            ? null
            : Number(newActivity.fixed_duration)
      });

      if (editingActivityId) {
        await activitiesApi.update(editingActivityId, payload);
      } else {
        await activitiesApi.create(payload);
      }

      resetActivityForm();
      await fetchActivities();
      setState(
        createUiState(
          "success",
          null,
          editingActivityId ? "Atividade atualizada com sucesso." : "Atividade criada com sucesso."
        )
      );
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setState(createUiState("error", detail || "Não foi possível salvar a atividade."));
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
      if (editingActivityId === id) {
        resetActivityForm();
      }
      await fetchActivities();
      setState(createUiState("success", null, "Atividade excluida com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível excluir a atividade."));
    }
  };

  const handleFrequencyChange = frequencyType => {
    setNewActivity(prev => ({
      ...prev,
      frequency_type: frequencyType,
      intercalate_days: frequencyType === "intercalate" ? prev.intercalate_days : ""
    }));
  };

  const startEditingActivity = activity => {
    setNewActivity(mapActivityToForm(activity));
    setEditingActivityId(activity?.id ?? null);
    setValidationErrors({});
    setState(createUiState());
  };

  const cancelEditingActivity = () => {
    resetActivityForm();
    setState(createUiState());
  };

  return {
    showActivitiesModal,
    setShowActivitiesModal,
    activities,
    newActivity,
    setNewActivity,
    editingActivityId,
    validationErrors,
    state,
    fetchActivities,
    createActivity,
    toggleActivity,
    deleteActivity,
    handleFrequencyChange,
    startEditingActivity,
    cancelEditingActivity,
    clearState: () => setState(createUiState())
  };
}
