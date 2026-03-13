import { useEffect, useState } from "react";
import Metronome from "./Metronome";
import ImageViewer from "./ImageViewer";
import BpmModal from "./BpmModal";
import TrainingUploadModal from "./TrainingUploadModal";
import TrainingHistoryModal from "./TrainingHistoryModal";
import api from "../../services/api";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import "./music.css";

export default function Music() {
  const [activeTab, setActiveTab] = useState("training");
  const [trainings, setTrainings] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [historyTraining, setHistoryTraining] = useState(null);
  const [artistsGrouped, setArtistsGrouped] = useState({});
  const [albums, setAlbums] = useState([]);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistImage, setNewArtistImage] = useState(null);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumImage, setNewAlbumImage] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(null);

  const fetchTrainings = async () => {
    try {
      const res = await api.get("/music/training");
      setTrainings(res.data.data);
    } catch (err) {
      console.error("Erro ao buscar treinos:", err);
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

  const renderSection = (instrumentKey, label) => {
    const filtered = trainings.filter((training) => training.instrument === instrumentKey);
    if (filtered.length === 0) return null;

    return (
      <div className="training-section reveal">
        <h3 className="training-section-title">
          {label} ({filtered.length})
        </h3>

        <div className="training-grid stagger">
          {filtered.map((training) => {
            const imageUrl = resolveMediaUrl(training.image_path);

            return (
              <div key={training.id} className="card training-card perf-willchange">
                <div className="training-thumb">
                  <img
                    src={imageUrl}
                    alt={training.name}
                    onClick={() => setSelectedImage(imageUrl)}
                    style={{ cursor: "zoom-in" }}
                  />

                  {training.last_bpm && (
                    <div className="bpm-badge">{training.last_bpm} BPM</div>
                  )}
                </div>

                <h4>{training.name}</h4>

                {training.last_bpm && (
                  <p className="training-meta">
                    Ultimo registro: {training.last_bpm} BPM
                  </p>
                )}

                <div className="training-actions">
                  <button
                    className="btn btn-secondary btn-sm perf-willchange"
                    onClick={() => setSelectedTraining(training.id)}
                  >
                    Registrar BPM
                  </button>

                  <button
                    className="btn btn-ghost btn-sm perf-willchange"
                    onClick={() => setHistoryTraining(training.id)}
                  >
                    Historico
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
                    className="btn btn-primary"
                    onClick={() => setShowUploadModal(true)}
                  >
                    Novo Treino
                  </button>
                </div>
              </div>

              {renderSection("guitar", "🎸 Guitarra")}
              {renderSection("keyboard", "🎹 Teclado")}
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
          onCreated={fetchTrainings}
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
          onSaved={fetchTrainings}
        />
      )}

      {historyTraining && (
        <TrainingHistoryModal
          trainingId={historyTraining}
          onClose={() => setHistoryTraining(null)}
        />
      )}
    </>
  );
}
