import { useEffect, useMemo, useState } from "react";
import Metronome from "./Metronome";
import ImageViewer from "./ImageViewer";
import BpmModal from "./BpmModal";
import TrainingUploadModal from "./TrainingUploadModal";
import TrainingHistoryModal from "./TrainingHistoryModal";
import TrainingExerciseModal from "./TrainingExerciseModal";
import TrainingPracticeModal from "./TrainingPracticeModal";
import api from "../../services/api";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import "./music.css";

const DEFAULT_TUNING = ["e", "B", "G", "D", "A", "E"];

const formatDateLabel = (value) => {
  if (!value) return "Ainda não praticado";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatBpmValue = (value) => {
  if (value === null || typeof value === "undefined" || Number.isNaN(Number(value))) {
    return "--";
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const normalizeExerciseData = (exerciseData) => {
  if (!exerciseData || typeof exerciseData !== "object") {
    return null;
  }

  const rawCells = Array.isArray(exerciseData.cells) ? exerciseData.cells : [];
  const columns = Number(exerciseData.columns) || rawCells[0]?.length || 8;

  return {
    ...exerciseData,
    columns,
    cells: Array.from({ length: 6 }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, columnIndex) => rawCells?.[rowIndex]?.[columnIndex] ?? "")
    ),
    notes: exerciseData.notes || "",
    measure_size: Math.max(2, Math.min(16, Number(exerciseData.measure_size) || 4)),
    library_group: String(exerciseData.library_group || "").trim() || null,
    difficulty: exerciseData.difficulty ? Number(exerciseData.difficulty) : null,
    tags: Array.isArray(exerciseData.tags)
      ? exerciseData.tags.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
};

const normalizeTraining = (training) => {
  if (!training || typeof training !== "object") {
    return null;
  }

  let exerciseData = training.exercise_data ?? null;
  if (typeof exerciseData === "string" && exerciseData.trim()) {
    try {
      exerciseData = JSON.parse(exerciseData);
    } catch (_) {
      exerciseData = null;
    }
  }

  let tuning = Array.isArray(training.tuning) ? training.tuning : [];
  if (!tuning.length && typeof training.tuning === "string" && training.tuning.trim()) {
    try {
      const parsed = JSON.parse(training.tuning);
      tuning = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      tuning = training.tuning.split("|").map((item) => item.trim()).filter(Boolean);
    }
  }

  return {
    ...training,
    instrument: String(training.instrument || "").trim().toLowerCase(),
    content_type: training.content_type || "image",
    image_path: training.image_path || null,
    exercise_data: normalizeExerciseData(exerciseData),
    tuning: tuning.length === 6 ? tuning : DEFAULT_TUNING,
    session_count: Number(training.session_count || 0),
    best_bpm: training.best_bpm === null || typeof training.best_bpm === "undefined" ? null : Number(training.best_bpm),
    average_bpm: training.average_bpm === null || typeof training.average_bpm === "undefined" ? null : Number(training.average_bpm),
    last_practiced_at: training.last_practiced_at || null,
  };
};

const sortTrainings = (items) =>
  [...items].sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));

function ExercisePreview({ training }) {
  const tuning = Array.isArray(training?.tuning) && training.tuning.length === 6
    ? training.tuning
    : DEFAULT_TUNING;
  const rawCells = Array.isArray(training?.exercise_data?.cells) ? training.exercise_data.cells : [];
  const cells = Array.from({ length: 6 }, (_, rowIndex) => (
    Array.isArray(rawCells[rowIndex]) ? rawCells[rowIndex] : []
  ));
  const columns = Number(training?.exercise_data?.columns) || cells[0]?.length || 8;
  const measureSize = Number(training?.exercise_data?.measure_size) || 4;
  const hasAnyValue = cells.some((row) => row.some((cell) => String(cell || "").trim()));

  if (!hasAnyValue) {
    return (
      <div className="training-tab-preview training-tab-preview--empty">
        <p>Exercício sem tablatura visível</p>
      </div>
    );
  }

  return (
    <div className="training-tab-preview" style={{ ["--tab-columns"]: columns }}>
      {tuning.map((stringName, rowIndex) => (
        <div key={`${training.id}-row-${rowIndex}`} className="training-tab-row">
          <span className="training-tab-string">{stringName}</span>
          <div className="training-tab-line">
            {Array.from({ length: columns }, (_, columnIndex) => {
              const cell = cells[rowIndex]?.[columnIndex] ?? "";
              return (
                <span
                  key={`${training.id}-cell-${rowIndex}-${columnIndex}`}
                  className={`training-tab-cell ${columnIndex % measureSize === 0 ? "is-measure-start" : ""}`}
                >
                  <span className={`training-tab-fret ${cell ? "has-value" : ""}`}>{cell || "\u00A0"}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExerciseCard({
  training,
  onEdit,
  onPractice,
  onRegisterBpm,
  onHistory,
  onDelete,
}) {
  const targetBpmLabel = training.target_bpm ? `${training.target_bpm} BPM alvo` : null;
  const libraryGroup = training.exercise_data?.library_group || "Biblioteca livre";
  const difficulty = training.exercise_data?.difficulty;
  const tags = training.exercise_data?.tags || [];

  return (
    <div key={training.id} className="card training-card training-card--exercise perf-willchange">
      <div className="training-thumb">
        <ExercisePreview training={training} />
        {training.last_bpm ? <div className="bpm-badge">{training.last_bpm} BPM</div> : null}
      </div>

      <div className="training-card-body">
        <div className="training-card-header">
          <div>
            <h4>{training.name}</h4>
            <p className="training-card-subtitle">{libraryGroup}</p>
          </div>
          <span className="training-type-pill">Exercício</span>
        </div>

        <div className="training-chip-row">
          {difficulty ? <span className="training-chip">Nível {difficulty}</span> : null}
          {targetBpmLabel ? <span className="training-chip">{targetBpmLabel}</span> : null}
          {tags.slice(0, 3).map((tag) => (
            <span key={`${training.id}-${tag}`} className="training-chip training-chip--soft">
              {tag}
            </span>
          ))}
        </div>

        <div className="training-stats-grid">
          <div>
            <span>Sessões</span>
            <strong>{training.session_count}</strong>
          </div>
          <div>
            <span>Melhor</span>
            <strong>{formatBpmValue(training.best_bpm)} BPM</strong>
          </div>
          <div>
            <span>Média</span>
            <strong>{formatBpmValue(training.average_bpm)} BPM</strong>
          </div>
          <div>
            <span>Última prática</span>
            <strong>{formatDateLabel(training.last_practiced_at)}</strong>
          </div>
        </div>

        <div className="training-actions">
          <button
            className="btn btn-primary btn-sm perf-willchange"
            onClick={() => onPractice(training)}
          >
            Praticar
          </button>
          <button
            className="btn btn-secondary btn-sm perf-willchange"
            onClick={() => onEdit(training)}
          >
            Editar exercício
          </button>
          <button
            className="btn btn-secondary btn-sm perf-willchange"
            onClick={() => onRegisterBpm(training.id)}
          >
            Registrar BPM
          </button>
          <button
            className="btn btn-ghost btn-sm perf-willchange"
            onClick={() => onHistory(training)}
          >
            Histórico
          </button>
          <button
            className="btn btn-danger btn-sm perf-willchange"
            onClick={() => onDelete(training)}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageTrainingCard({ training, onSelectImage, onRegisterBpm, onHistory }) {
  return (
    <div key={training.id} className="card training-card perf-willchange">
      <div className="training-thumb">
        <img
          src={resolveMediaUrl(training.image_path)}
          alt={training.name}
          onClick={() => onSelectImage(resolveMediaUrl(training.image_path))}
          style={{ cursor: "zoom-in" }}
        />

        {training.last_bpm ? <div className="bpm-badge">{training.last_bpm} BPM</div> : null}
      </div>

      <h4>{training.name}</h4>

      {training.last_bpm ? (
        <p className="training-meta">
          Último registro: {training.last_bpm} BPM
        </p>
      ) : null}

      <div className="training-actions">
        <button
          className="btn btn-secondary btn-sm perf-willchange"
          onClick={() => onRegisterBpm(training.id)}
        >
          Registrar BPM
        </button>

        <button
          className="btn btn-ghost btn-sm perf-willchange"
          onClick={() => onHistory(training)}
        >
          Histórico
        </button>
      </div>
    </div>
  );
}

export default function Music() {
  const [activeTab, setActiveTab] = useState("training");
  const [trainings, setTrainings] = useState([]);
  const [isLoadingTrainings, setIsLoadingTrainings] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [exerciseModalTraining, setExerciseModalTraining] = useState(null);
  const [practiceTraining, setPracticeTraining] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [historyTraining, setHistoryTraining] = useState(null);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseGroupFilter, setExerciseGroupFilter] = useState("all");
  const [exerciseDifficultyFilter, setExerciseDifficultyFilter] = useState("all");
  const [exerciseTagFilter, setExerciseTagFilter] = useState("all");
  const [artistsGrouped, setArtistsGrouped] = useState({});
  const [albums, setAlbums] = useState([]);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistImage, setNewArtistImage] = useState(null);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumImage, setNewAlbumImage] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(null);

  const fetchTrainings = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setIsLoadingTrainings(true);
      }
      const res = await api.get("/music/training");
      const nextTrainings = Array.isArray(res.data.data)
        ? res.data.data.map(normalizeTraining).filter(Boolean)
        : [];
      setTrainings(sortTrainings(nextTrainings));
    } catch (err) {
      console.error("Erro ao buscar treinos:", err);
    } finally {
      setIsLoadingTrainings(false);
    }
  };

  const handleTrainingSaved = async (savedTraining) => {
    if (savedTraining?.id) {
      const normalizedTraining = normalizeTraining(savedTraining);
      setTrainings((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== normalizedTraining.id);
        const next = normalizedTraining ? [normalizedTraining, ...withoutCurrent] : withoutCurrent;
        return sortTrainings(next);
      });
    }

    await fetchTrainings({ silent: true });
  };

  const handleDeleteTraining = async (training) => {
    if (!training?.id) {
      return;
    }

    const confirmed = window.confirm(`Excluir o exercício "${training.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/music/training/${training.id}`);
      setTrainings((previous) => previous.filter((item) => item.id !== training.id));
      if (practiceTraining?.id === training.id) {
        setPracticeTraining(null);
      }
      if (historyTraining?.id === training.id) {
        setHistoryTraining(null);
      }
      if (exerciseModalTraining?.id === training.id) {
        setExerciseModalTraining(null);
      }
    } catch (error) {
      console.error("Erro ao excluir exercício:", error);
    }
  };

  const fetchListening = async () => {
    try {
      const [artistsRes, albumsRes] = await Promise.all([
        api.get("/music/artists"),
        api.get("/music/albums"),
      ]);

      setArtistsGrouped(artistsRes.data.data);
      setAlbums(albumsRes.data.data);
    } catch (err) {
      console.error("Erro ao buscar listening:", err);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  useEffect(() => {
    if (activeTab === "listening") {
      fetchListening();
    }
  }, [activeTab]);

  const allExercises = useMemo(
    () => trainings.filter((training) => training.content_type === "exercise"),
    [trainings]
  );

  const availableExerciseGroups = useMemo(
    () => [...new Set(allExercises.map((training) => training.exercise_data?.library_group).filter(Boolean))],
    [allExercises]
  );

  const availableExerciseTags = useMemo(
    () => [...new Set(allExercises.flatMap((training) => training.exercise_data?.tags || []))],
    [allExercises]
  );

  const renderSection = (instrumentKey, label, emptyLabel) => {
    const filtered = trainings.filter(
      (training) => String(training.instrument || "").trim().toLowerCase() === instrumentKey
    );
    const exercises = filtered.filter((training) => training.content_type === "exercise");
    const imageTrainings = filtered.filter((training) => training.content_type !== "exercise");

    const filteredExercises = exercises.filter((training) => {
      const title = String(training.name || "").toLowerCase();
      const notes = String(training.exercise_data?.notes || "").toLowerCase();
      const tags = (training.exercise_data?.tags || []).map((tag) => tag.toLowerCase());
      const group = training.exercise_data?.library_group || "";
      const difficulty = String(training.exercise_data?.difficulty || "");

      const matchesQuery = !exerciseQuery.trim()
        || title.includes(exerciseQuery.trim().toLowerCase())
        || notes.includes(exerciseQuery.trim().toLowerCase())
        || tags.some((tag) => tag.includes(exerciseQuery.trim().toLowerCase()));
      const matchesGroup = exerciseGroupFilter === "all" || group === exerciseGroupFilter;
      const matchesDifficulty = exerciseDifficultyFilter === "all" || difficulty === exerciseDifficultyFilter;
      const matchesTag = exerciseTagFilter === "all" || tags.includes(exerciseTagFilter.toLowerCase());

      return matchesQuery && matchesGroup && matchesDifficulty && matchesTag;
    });

    return (
      <div className="training-section">
        <h3 className="training-section-title">
          {label} ({filtered.length})
        </h3>

        {filtered.length === 0 ? (
          <div className="app-state-card app-state-card--inline">
            <p className="app-state-card__title">Nenhum treino nesta seção</p>
            <p className="app-state-card__text">Adicione um treino ou exercício para {emptyLabel}.</p>
          </div>
        ) : (
          <>
            {exercises.length > 0 ? (
              <div className="training-library-panel">
                <div className="training-library-panel__header">
                  <div>
                    <h4>Biblioteca de exercícios</h4>
                    <p>{filteredExercises.length} exercício(s) filtrado(s) de {exercises.length}</p>
                  </div>
                </div>

                <div className="training-library-filters">
                  <input
                    className="input"
                    placeholder="Buscar por nome, nota ou tag"
                    value={exerciseQuery}
                    onChange={(event) => setExerciseQuery(event.target.value)}
                  />

                  <select
                    className="input"
                    value={exerciseGroupFilter}
                    onChange={(event) => setExerciseGroupFilter(event.target.value)}
                  >
                    <option value="all">Todas as bibliotecas</option>
                    {availableExerciseGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>

                  <select
                    className="input"
                    value={exerciseDifficultyFilter}
                    onChange={(event) => setExerciseDifficultyFilter(event.target.value)}
                  >
                    <option value="all">Todas as dificuldades</option>
                    <option value="1">Nível 1</option>
                    <option value="2">Nível 2</option>
                    <option value="3">Nível 3</option>
                    <option value="4">Nível 4</option>
                    <option value="5">Nível 5</option>
                  </select>

                  <select
                    className="input"
                    value={exerciseTagFilter}
                    onChange={(event) => setExerciseTagFilter(event.target.value)}
                  >
                    <option value="all">Todas as tags</option>
                    {availableExerciseTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredExercises.length === 0 ? (
                  <div className="app-state-card app-state-card--inline">
                    <p className="app-state-card__title">Nenhum exercício com este filtro</p>
                    <p className="app-state-card__text">Ajuste os filtros da biblioteca para ver outros estudos.</p>
                  </div>
                ) : (
                  <div className="training-grid training-grid--library">
                    {filteredExercises.map((training) => (
                      <ExerciseCard
                        key={training.id}
                        training={training}
                        onEdit={setExerciseModalTraining}
                        onPractice={setPracticeTraining}
                        onRegisterBpm={setSelectedTraining}
                        onHistory={setHistoryTraining}
                        onDelete={handleDeleteTraining}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {imageTrainings.length > 0 ? (
              <div className="training-library-panel">
                <div className="training-library-panel__header">
                  <div>
                    <h4>Treinos por imagem</h4>
                    <p>Referências visuais e estudos antigos do instrumento.</p>
                  </div>
                </div>

                <div className="training-grid">
                  {imageTrainings.map((training) => (
                    <ImageTrainingCard
                      key={training.id}
                      training={training}
                      onSelectImage={setSelectedImage}
                      onRegisterBpm={setSelectedTraining}
                      onHistory={setHistoryTraining}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  const openAlbumModal = (artistId) => {
    setSelectedArtistId(artistId);
    setShowAlbumModal(true);
  };

  const createArtist = async () => {
    if (!newArtistName.trim()) return;

    try {
      const formData = new FormData();
      formData.append("name", newArtistName.trim());

      if (newArtistImage) {
        formData.append("image", newArtistImage);
      }

      await api.post("/music/artists", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setNewArtistName("");
      setNewArtistImage(null);
      setShowArtistModal(false);
      fetchListening();
    } catch (err) {
      console.error("Erro ao criar artista:", err);
    }
  };

  const createAlbum = async () => {
    if (!newAlbumName.trim() || !selectedArtistId) return;

    try {
      const formData = new FormData();
      formData.append("artist_id", selectedArtistId);
      formData.append("name", newAlbumName.trim());

      if (newAlbumImage) {
        formData.append("image", newAlbumImage);
      }

      await api.post("/music/albums", formData);

      setNewAlbumName("");
      setNewAlbumImage(null);
      setSelectedArtistId(null);
      setShowAlbumModal(false);
      fetchListening();
    } catch (err) {
      console.error("Erro ao criar album:", err);
    }
  };

  const confirmAlbum = async (albumId) => {
    try {
      await api.patch(`/music/albums/${albumId}/confirm`);
      fetchListening();
    } catch (err) {
      console.error("Erro ao confirmar album:", err);
    }
  };

  return (
    <>
      <div className="page-container fade-in music-page">
        <h1 className="music-title">Musica</h1>

        <div className="music-tabs">
          <button
            className={`music-tab ${activeTab === "training" ? "active" : ""}`}
            onClick={() => setActiveTab("training")}
          >
            🎼 Training
          </button>

          <button
            className={`music-tab ${activeTab === "listening" ? "active" : ""}`}
            onClick={() => setActiveTab("listening")}
          >
            🎵 Listening
          </button>
        </div>

        {activeTab === "training" && (
          <div className="music-mode-shell page-shell">
            <div className="music-toolbar">
              <h2>Treinos</h2>
              <div className="music-toolbar-actions">
                <Metronome />
                <button
                  className="btn btn-secondary"
                  onClick={() => setExerciseModalTraining({})}
                >
                  Novo Exercício
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowUploadModal(true)}
                >
                  Novo Treino
                </button>
              </div>
            </div>

            {isLoadingTrainings && trainings.length === 0 ? (
              <div className="app-state-card app-state-card--inline">
                <p className="app-state-card__title">Carregando treinos</p>
                <p className="app-state-card__text">Buscando exercícios, imagens e histórico de BPM.</p>
              </div>
            ) : null}

            {isLoadingTrainings && trainings.length > 0 ? (
              <div className="app-state-card app-state-card--inline">
                <p className="app-state-card__title">Atualizando treinos</p>
                <p className="app-state-card__text">Sincronizando a biblioteca sem esconder os exercícios já visíveis.</p>
              </div>
            ) : null}

            {renderSection("guitar", "🎸 Guitarra", "guitarra")}
            {renderSection("keyboard", "🎹 Teclado", "teclado")}
          </div>
        )}

        {activeTab === "listening" && (
          <div className="music-library music-mode-shell page-shell">
            <div className="library-header">
              <h2>Biblioteca</h2>
              <button
                className="btn btn-primary"
                onClick={() => setShowArtistModal(true)}
              >
                + Novo Artista
              </button>
            </div>

            <h3 className="section-title">Artistas</h3>

            <div className="artist-grid">
              {Object.values(artistsGrouped).flat().map((artist) => (
                <div
                  key={artist.id}
                  className="artist-card"
                  onClick={() => openAlbumModal(artist.id)}
                >
                  <div className="artist-avatar">
                    {artist.image_path ? (
                      <img
                        src={resolveMediaUrl(artist.image_path)}
                        alt={artist.name}
                      />
                    ) : (
                      "🎤"
                    )}
                  </div>
                  <div className="artist-name">{artist.name}</div>
                </div>
              ))}
            </div>

            <h3 className="section-title">Albuns</h3>

            <div className="album-grid">
              {albums.map((album) => (
                <div key={album.id} className={`album-card ${album.status}`}>
                  <div className="album-cover-wrapper">
                    {album.image_path ? (
                      <img
                        src={resolveMediaUrl(album.image_path)}
                        alt={album.name}
                      />
                    ) : (
                      <div className="album-placeholder">🎵</div>
                    )}

                    {album.status === "planned" && (
                      <button
                        className="album-overlay-button"
                        onClick={() => confirmAlbum(album.id)}
                      >
                        Marcar como ouvido
                      </button>
                    )}
                  </div>

                  <div className="album-meta">
                    <span className="album-name">{album.name}</span>
                    <span className="album-artist">{album.artist}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showArtistModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Novo Artista</h3>
            <input
              type="text"
              placeholder="Nome do artista"
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              className="input"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewArtistImage(e.target.files[0])}
              className="input"
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowArtistModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={createArtist}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlbumModal && selectedArtistId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Novo Album</h3>

            <input
              type="text"
              placeholder="Nome do album"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              className="input"
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewAlbumImage(e.target.files[0])}
              className="input"
            />

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowAlbumModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={createAlbum}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <TrainingUploadModal
          onClose={() => setShowUploadModal(false)}
          onCreated={() => fetchTrainings({ silent: true })}
        />
      )}

      {exerciseModalTraining !== null && (
        <TrainingExerciseModal
          training={exerciseModalTraining?.id ? exerciseModalTraining : null}
          onClose={() => setExerciseModalTraining(null)}
          onSaved={handleTrainingSaved}
        />
      )}

      {practiceTraining && (
        <TrainingPracticeModal
          training={practiceTraining}
          onClose={() => setPracticeTraining(null)}
          onRecorded={() => fetchTrainings({ silent: true })}
        />
      )}

      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {selectedTraining && (
        <BpmModal
          trainingId={selectedTraining}
          onClose={() => setSelectedTraining(null)}
          onSaved={() => fetchTrainings({ silent: true })}
        />
      )}

      {historyTraining && (
        <TrainingHistoryModal
          training={historyTraining}
          onClose={() => setHistoryTraining(null)}
        />
      )}
    </>
  );
}
