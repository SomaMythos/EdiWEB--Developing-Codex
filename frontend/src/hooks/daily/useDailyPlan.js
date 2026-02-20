import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_URL, DEFAULT_SUMMARY } from "./constants";
import { createUiState, isBlockCompleted } from "./utils";

export function useDailyPlan(selectedDate) {
  const [dayType, setDayType] = useState("work");
  const [blocks, setBlocks] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loadState, setLoadState] = useState(createUiState("loading"));
  const [actionState, setActionState] = useState(createUiState());
  const [generating, setGenerating] = useState(false);

  const fetchDaily = useCallback(async date => {
    const res = await axios.get(`${API_URL}/daily/${date}`);
    if (res.data.success) setBlocks(res.data.data);
  }, []);

  const fetchSummary = useCallback(async date => {
    const res = await axios.get(`${API_URL}/daily/summary`, { params: { date } });
    if (res.data.success) setSummary(res.data.data);
  }, []);

  const fetchDayType = useCallback(async date => {
    const res = await axios.get(`${API_URL}/daily/type`, { params: { date } });
    if (res.data.success) setDayType(res.data.data.type);
  }, []);

  const refreshAll = useCallback(async (date = selectedDate) => {
    setLoadState(createUiState("loading"));
    try {
      await Promise.all([fetchDaily(date), fetchSummary(date), fetchDayType(date)]);
      setLoadState(createUiState("success"));
    } catch (error) {
      console.error(error);
      setBlocks([]);
      setSummary(DEFAULT_SUMMARY);
      setDayType("work");
      setLoadState(createUiState("error", "Não foi possível carregar os dados diários."));
    }
  }, [fetchDaily, fetchSummary, fetchDayType, selectedDate]);

  useEffect(() => {
    refreshAll(selectedDate);
  }, [selectedDate, refreshAll]);

  const toggleDayType = useCallback(async () => {
    const isOff = dayType === "work";
    setActionState(createUiState("loading"));
    try {
      await axios.post(`${API_URL}/daily/override`, { date: selectedDate, is_off: isOff });
      await refreshAll(selectedDate);
      setActionState(createUiState("success", null, "Tipo de dia atualizado."));
    } catch (error) {
      console.error(error);
      setActionState(createUiState("error", "Não foi possível alternar o tipo de dia."));
    }
  }, [dayType, refreshAll, selectedDate]);

  const generateDaily = useCallback(async () => {
    setGenerating(true);
    setActionState(createUiState("loading"));
    try {
      await axios.post(`${API_URL}/daily/generate`, null, { params: { date: selectedDate } });
      await refreshAll(selectedDate);
      setActionState(createUiState("success", null, "Planejamento gerado com sucesso."));
    } catch (error) {
      console.error(error);
      setActionState(createUiState("error", "Não foi possível gerar o planejamento do dia."));
    } finally {
      setGenerating(false);
    }
  }, [refreshAll, selectedDate]);

  const toggleCompletion = useCallback(async (blockId, currentState) => {
    const nextState = !Boolean(currentState);
    setActionState(createUiState("loading"));
    try {
      await axios.patch(`${API_URL}/daily/block/${blockId}/complete`, { completed: nextState });
      setBlocks(prev => prev.map(b => (b.id === blockId ? { ...b, completed: nextState } : b)));
      await fetchSummary(selectedDate);
      setActionState(createUiState("success", null, "Status do bloco atualizado."));
    } catch (error) {
      console.error(error);
      setActionState(createUiState("error", "Não foi possível atualizar o status do bloco."));
    }
  }, [fetchSummary, selectedDate]);

  const completedDuration = blocks.filter(b => isBlockCompleted(b.completed)).reduce((sum, b) => sum + b.duration, 0);
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);

  return {
    dayType,
    blocks,
    summary,
    loadState,
    actionState,
    generating,
    totalDuration,
    completedDuration,
    refreshAll,
    toggleDayType,
    generateDaily,
    toggleCompletion,
    clearActionState: () => setActionState(createUiState())
  };
}
