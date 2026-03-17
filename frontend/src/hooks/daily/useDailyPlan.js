import { useCallback, useEffect, useState } from "react";
import { calendarApi, dailyApi } from "../../services/api";
import { DEFAULT_SUMMARY } from "./constants";
import { createUiState, isBlockCompleted } from "./utils";

export function useDailyPlan(selectedDate) {
  const [dayType, setDayType] = useState("work");
  const [blocks, setBlocks] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loadState, setLoadState] = useState(createUiState("loading"));
  const [actionState, setActionState] = useState(createUiState());
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

  const getBackendErrorMessage = error => {
    const payload = error?.response?.data;
    if (!payload) return null;
    return payload.message || payload.error || payload.detail || null;
  };

  const fetchDaily = useCallback(async date => {
    const res = await dailyApi.getByDate(date);
    if (res.data.success) setBlocks(res.data.data);
  }, []);

  const fetchSummary = useCallback(async date => {
    const res = await dailyApi.getSummary(date);
    if (res.data.success) setSummary(res.data.data);
  }, []);

  const fetchDayType = useCallback(async date => {
    const res = await dailyApi.getDayType(date);
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
      await dailyApi.overrideDayType(selectedDate, isOff);
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
    setGenerationResult(null);
    try {
      const res = await dailyApi.generate(selectedDate);
      const generationData = res?.data?.data || {};
      setGenerationResult({
        notScheduled: Array.isArray(generationData.not_scheduled) ? generationData.not_scheduled : [],
        diagnostics: generationData.diagnostics || null
      });
      await refreshAll(selectedDate);
      setActionState(createUiState("success", null, "Planejamento gerado com sucesso."));
    } catch (error) {
      console.error(error);
      const backendMessage = getBackendErrorMessage(error);
      setActionState(createUiState("error", backendMessage || "Não foi possível gerar o planejamento do dia."));
    } finally {
      setGenerating(false);
    }
  }, [refreshAll, selectedDate]);

  const toggleCompletion = useCallback(async (blockId, currentState, block = null) => {
    const nextState = !Boolean(currentState);
    setActionState(createUiState("loading"));
    try {
      if (block?.source_type === "calendar") {
        await calendarApi.completeEvent(block.calendar_event_id, nextState);
      } else if (Array.isArray(block?.linked_block_ids) && block.linked_block_ids.length > 0) {
        await Promise.all(block.linked_block_ids.map(id => dailyApi.completeBlock(id, nextState)));
      } else {
        await dailyApi.completeBlock(blockId, nextState);
      }
      await refreshAll(selectedDate);
      setActionState(createUiState("success", null, "Status do bloco atualizado."));
    } catch (error) {
      console.error(error);
      setActionState(createUiState("error", "Não foi possível atualizar o status do bloco."));
    }
  }, [refreshAll, selectedDate]);

  const updateBlock = useCallback(async (blockId, payload) => {
    setActionState(createUiState("loading"));
    const previousBlocks = [...blocks];
    const updatedBlocks = blocks.map(block => (
      block.id === blockId
        ? {
          ...block,
          start_time: payload.start_time,
          duration: payload.duration,
          block_name: payload.block_name,
          block_category: payload.block_category,
          updated_source: payload.updated_source || "manual",
          activity_title: payload.block_name || block.activity_title
        }
        : block
    )).sort((a, b) => a.start_time.localeCompare(b.start_time));

    setBlocks(updatedBlocks);

    try {
      await dailyApi.updateBlock(blockId, payload);
      await fetchSummary(selectedDate);
      setActionState(createUiState("success", null, "Bloco atualizado com sucesso."));
    } catch (error) {
      console.error(error);
      setBlocks(previousBlocks);
      const backendMessage = getBackendErrorMessage(error);
      setActionState(createUiState("error", backendMessage || "Não foi possível editar o bloco."));
    }
  }, [blocks, fetchSummary, selectedDate]);

  const completedDuration = blocks.filter(b => isBlockCompleted(b.completed)).reduce((sum, b) => sum + b.duration, 0);
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);

  return {
    dayType,
    blocks,
    summary,
    loadState,
    actionState,
    generating,
    generationResult,
    totalDuration,
    completedDuration,
    refreshAll,
    toggleDayType,
    generateDaily,
    toggleCompletion,
    updateBlock,
    clearActionState: () => setActionState(createUiState())
  };
}
