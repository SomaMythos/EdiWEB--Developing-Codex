import { useState } from "react";
import axios from "axios";
import { API_URL, DEFAULT_ACTIVITY } from "./constants";
import { createUiState } from "./utils";

export function useActivities() {
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState(DEFAULT_ACTIVITY);
  const [state, setState] = useState(createUiState());

  const fetchActivities = async () => {
    setState(createUiState("loading"));
    try {
      const res = await axios.get(`${API_URL}/activities`);
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
    if (!newActivity.title) {
      setState(createUiState("error", "Preencha o título."));
      return;
    }

    setState(createUiState("loading"));
    try {
      const payload = {
        ...newActivity,
        fixed_time: newActivity.frequency_type === "flex" ? null : newActivity.fixed_time || null,
        fixed_duration: newActivity.frequency_type === "flex" ? null : newActivity.fixed_duration
      };
      await axios.post(`${API_URL}/activities`, payload);
      setNewActivity(DEFAULT_ACTIVITY);
      await fetchActivities();
      setState(createUiState("success", null, "Atividade criada com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível criar a atividade."));
    }
  };

  const toggleActivity = async id => {
    setState(createUiState("loading"));
    try {
      await axios.patch(`${API_URL}/activities/${id}/toggle`);
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
      await axios.delete(`${API_URL}/activities/${id}`);
      await fetchActivities();
      setState(createUiState("success", null, "Atividade excluída com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível excluir a atividade."));
    }
  };

  const handleFrequencyChange = frequencyType => {
    setNewActivity(prev =>
      frequencyType === "flex"
        ? { ...prev, frequency_type: "flex", fixed_time: "", fixed_duration: 30 }
        : { ...prev, frequency_type: frequencyType }
    );
  };

  return {
    showActivitiesModal,
    setShowActivitiesModal,
    activities,
    newActivity,
    setNewActivity,
    state,
    fetchActivities,
    createActivity,
    toggleActivity,
    deleteActivity,
    handleFrequencyChange,
    clearState: () => setState(createUiState())
  };
}
