import { useEffect, useState } from "react";
import axios from "axios";
import Metronome from "./Metronome";
import ImageViewer from "./ImageViewer";
import BpmModal from "./BpmModal";
import TrainingUploadModal from "./TrainingUploadModal";
import TrainingHistoryModal from "./TrainingHistoryModal";
import "./music.css";

export default function Music() {
  const [activeTab, setActiveTab] = useState("training");

  // ================= TRAINING =================
  const [trainings, setTrainings] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [historyTraining, setHistoryTraining] = useState(null);

  // ================= LISTENING =================
  const [artistsGrouped, setArtistsGrouped] = useState({});
  const [albums, setAlbums] = useState([]);
  const [expandedArtists, setExpandedArtists] = useState({});
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistImage, setNewArtistImage] = useState(null);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState(null);

  // ================= FETCH =================
  const fetchTrainings = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/music/training");
      setTrainings(res.data.data);
    } catch (err) {
      console.error("Erro ao buscar treinos:", err);
    }
  };

  const fetchListening = async () => {
    try {
      const [artistsRes, albumsRes] = await Promise.all([
        axios.get("http://localhost:8000/api/music/artists"),
        axios.get("http://localhost:8000/api/music/albums"),
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

  // ================= TRAINING RENDER =================
  const renderSection = (instrumentKey, label) => {
    const filtered = trainings.filter((t) => t.instrument === instrumentKey);
    if (filtered.length === 0) return null;

    return (
      <div className="training-section reveal">
        <h3 className="training-section-title">
          {label} ({filtered.length})
        </h3>

        <div className="training-grid stagger">
          {filtered.map((t) => (
            <div key={t.id} className="card training-card perf-willchange">
              <div className="training-thumb">
                <img
                  src={`http://localhost:8000/${t.image_path}`}
                  alt={t.name}
                  onClick={() =>
                    setSelectedImage(
                      `http://localhost:8000/${t.image_path}`
                    )
                  }
                  style={{ cursor: "zoom-in" }}
                />

                {t.last_bpm && (
                  <div className="bpm-badge">{t.last_bpm} BPM</div>
                )}
              </div>

              <h4>{t.name}</h4>

              {t.last_bpm && (
                <p className="training-meta">
                  Último registro: {t.last_bpm} BPM
                </p>
              )}

              <div className="training-actions">
                <button
                  className="btn btn-secondary btn-sm perf-willchange"
                  onClick={() => setSelectedTraining(t.id)}
                >
                  Registrar BPM
                </button>

                <button
                  className="btn btn-ghost btn-sm perf-willchange"
                  onClick={() => setHistoryTraining(t.id)}
                >
                  Histórico
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ================= LISTENING =================


const [newAlbumImage, setNewAlbumImage] = useState(null);



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

    await axios.post(
      "http://localhost:8000/api/music/artists",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

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

    await axios.post(
      "http://localhost:8000/api/music/albums",
      formData
    );

    setNewAlbumName("");
    setNewAlbumImage(null);
    setSelectedArtistId(null);
    setShowAlbumModal(false);
    fetchListening();

  } catch (err) {
    console.error("Erro ao criar álbum:", err);
  }
};

const confirmAlbum = async (albumId) => {
  try {
    await axios.patch(
      `http://localhost:8000/api/music/albums/${albumId}/confirm`
    );

    fetchListening();

  } catch (err) {
    console.error("Erro ao confirmar álbum:", err);
  }
};

  const renderArtistAlbums = (artist) => {
    const artistAlbums = albums.filter((a) => a.artist === artist.name);
    const planned = artistAlbums.filter((a) => a.status === "planned");
    const listened = artistAlbums.filter((a) => a.status === "listened");

    return (
      <div className="artist-albums">
        <button
          className="btn btn-secondary btn-sm perf-willchange"
          onClick={() => openAlbumModal(artist.id)}
        >
          + Álbum
        </button>

        {planned.length > 0 && (
          <div className="album-group planned-group">
            <h4>🕓 Planned</h4>
            {planned.map((album) => (
              <div key={album.id} className="album-item">
                <div className="album-info">
  {album.image_path && (
    <img
      src={`http://localhost:8000/${album.image_path}`}
      alt={album.name}
      className="album-cover"
    />
  )}
  <span>{album.name}</span>
</div>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => confirmAlbum(album.id)}
                >
                  Confirmar ouvido
                </button>
              </div>
            ))}
          </div>
        )}

        {listened.length > 0 && (
          <div className="album-group listened-group">
            <h4>✅ Listened</h4>
            {listened.map((album) => (
              <div key={album.id} className="album-item listened">
                {album.name}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ================= RENDER =================

  return (
    <>
      <div className="music-page">
        <div className="glass-strong music-container">
          <h1 className="music-title">Música</h1>

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

          {/* TRAINING */}
          {activeTab === "training" && (
            <>
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
            </>
          )}

          {/* LISTENING */}
          {activeTab === "listening" && (
  <div className="music-library">

  <div className="library-header">
    <h2>Biblioteca</h2>
    <button
      className="btn btn-primary"
      onClick={() => setShowArtistModal(true)}
    >
      + Novo Artista
    </button>
  </div>

  {/* ===== ARTISTAS (Spotify style) ===== */}
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
      src={`http://localhost:8000/${artist.image_path}`}
      alt={artist.name}
    />
  ) : (
    "🎤"
  )}
</div>
        <div className="artist-name">
          {artist.name}
        </div>
      </div>
    ))}
  </div>

  {/* ===== ÁLBUNS ===== */}
  <h3 className="section-title">Álbuns</h3>

  <div className="album-grid">
    {albums.map((album) => (
      <div
        key={album.id}
        className={`album-card ${album.status}`}
      >
        <div className="album-cover-wrapper">
          {album.image_path ? (
            <img
              src={`http://localhost:8000/${album.image_path}`}
              alt={album.name}
            />
          ) : (
            <div className="album-placeholder">
              🎵
            </div>
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
      </div>

      {/* ARTIST MODAL */}
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
              <button
                className="btn btn-primary"
                onClick={createArtist}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALBUM MODAL */}
      {showAlbumModal && selectedArtistId && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Novo Álbum</h3>

      <input
        type="text"
        placeholder="Nome do álbum"
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
        <button
          className="btn btn-primary"
          onClick={createAlbum}
        >
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