import { useState } from "react";
import { activityCountersApi } from "../../services/api";
import { createUiState } from "./utils";

export function useActivityCounters() {
  const [showCountersModal, setShowCountersModal] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [counters, setCounters] = useState([]);
  const [summary, setSummary] = useState({
    open_count: 0,
    completed_count: 0,
    averages: []
  });
  const [validationError, setValidationError] = useState("");
  const [state, setState] = useState(createUiState());

  const updateCounterName = (value) => {
    setCounterName(value);
    if (validationError) {
      setValidationError("");
    }
  };

  const fetchCounters = async ({ openModal = true, silent = false } = {}) => {
    if (!silent) {
      setState(createUiState("loading"));
    }

    try {
      const res = await activityCountersApi.list();
      const data = res?.data?.data || {};
      setCounters(Array.isArray(data.items) ? data.items : []);
      setSummary({
        open_count: Number(data?.summary?.open_count) || 0,
        completed_count: Number(data?.summary?.completed_count) || 0,
        averages: Array.isArray(data?.summary?.averages) ? data.summary.averages : []
      });

      if (openModal) {
        setShowCountersModal(true);
      }

      if (!silent) {
        setState(createUiState("success"));
      }
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Nao foi possivel carregar os contadores."));
    }
  };

  const createCounter = async () => {
    const trimmedName = (counterName || "").trim();

    if (!trimmedName) {
      setValidationError("Informe um nome para registrar o contador.");
      setState(createUiState("error", "Preencha o nome antes de registrar."));
      return;
    }

    setValidationError("");
    setState(createUiState("loading"));

    try {
      await activityCountersApi.create({ title: trimmedName });
      setCounterName("");
      await fetchCounters({ openModal: true, silent: true });
      setState(createUiState("success", null, "Contador registrado com sucesso."));
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setState(createUiState("error", detail || "Nao foi possivel registrar o contador."));
    }
  };

  const completeCounter = async (counterId) => {
    setState(createUiState("loading"));

    try {
      await activityCountersApi.complete(counterId);
      await fetchCounters({ openModal: true, silent: true });
      setState(createUiState("success", null, "Contador concluido com sucesso."));
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setState(createUiState("error", detail || "Nao foi possivel concluir o contador."));
    }
  };

  const closeCountersModal = () => {
    setShowCountersModal(false);
    setCounterName("");
    setValidationError("");
    setState(createUiState());
  };

  return {
    showCountersModal,
    setShowCountersModal,
    counterName,
    setCounterName: updateCounterName,
    counters,
    summary,
    validationError,
    state,
    fetchCounters,
    createCounter,
    completeCounter,
    closeCountersModal
  };
}
