import { useState } from "react";
import { dailyApi, routinesApi } from "../../services/api";
import { DEFAULT_ROUTINE_BLOCK } from "./constants";
import { createUiState } from "./utils";

export function useDailyRoutines(selectedDate, dayType) {
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [routineBlocks, setRoutineBlocks] = useState([]);
  const [newBlock, setNewBlock] = useState(DEFAULT_ROUTINE_BLOCK);
  const [state, setState] = useState(createUiState());

  const fetchActiveRoutine = async () => {
    setState(createUiState("loading"));
    try {
      const res = await dailyApi.getRoutine(selectedDate);
      if (res.data.success && res.data.data) {
        setActiveRoutine(res.data.data.routine);
        setRoutineBlocks(res.data.data.blocks || []);
      } else {
        setActiveRoutine(null);
        setRoutineBlocks([]);
      }
      setShowRoutineModal(true);
      setState(createUiState("success"));
    } catch (error) {
      console.error(error);
      setActiveRoutine(null);
      setRoutineBlocks([]);
      setState(createUiState("error", "Não foi possível carregar a rotina deste dia."));
    }
  };

  const createRoutine = async () => {
    setState(createUiState("loading"));
    try {
      await routinesApi.create(`Rotina ${dayType === "work" ? "Work" : "Off"}`, dayType);
      await fetchActiveRoutine();
      setState(createUiState("success", null, "Rotina criada com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível criar uma rotina para este tipo de dia."));
    }
  };

  const addRoutineBlock = async () => {
    const blockName = newBlock.name.trim();
    if (!blockName) {
      setState(createUiState("error", "Nome do bloco é obrigatório."));
      return;
    }
    if (!newBlock.start_time || !newBlock.end_time) {
      setState(createUiState("error", "Preencha os horários de início e fim."));
      return;
    }
    if (newBlock.start_time === newBlock.end_time) {
      setState(createUiState("error", "Horário de fim deve ser diferente do início."));
      return;
    }

    setState(createUiState("loading"));
    try {
      await routinesApi.addBlock({
        routine_id: activeRoutine.id,
        ...newBlock,
        name: blockName
      });
      setNewBlock(DEFAULT_ROUTINE_BLOCK);
      await fetchActiveRoutine();
      setState(createUiState("success", null, "Bloco adicionado na rotina."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível adicionar o bloco na rotina."));
    }
  };

  const removeRoutineBlock = async blockId => {
    setState(createUiState("loading"));
    try {
      await routinesApi.removeBlock(blockId);
      await fetchActiveRoutine();
      setState(createUiState("success", null, "Bloco removido da rotina."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível remover o bloco da rotina."));
    }
  };

  return {
    showRoutineModal,
    setShowRoutineModal,
    activeRoutine,
    routineBlocks,
    newBlock,
    setNewBlock,
    state,
    fetchActiveRoutine,
    createRoutine,
    addRoutineBlock,
    removeRoutineBlock,
    clearState: () => setState(createUiState())
  };
}
