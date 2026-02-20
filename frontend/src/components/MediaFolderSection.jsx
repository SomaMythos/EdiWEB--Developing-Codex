import React, { useEffect, useMemo, useState } from 'react';
import { paintingsApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './MediaFolderSection.css';

const emptyUploadForm = { title: '', date: '', photo: null };

const MediaFolderSection = ({ category, title }) => {
  const [folders, setFolders] = useState([]);
  const [itemsByFolder, setItemsByFolder] = useState({});
  const [slideByFolder, setSlideByFolder] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [renameByFolder, setRenameByFolder] = useState({});
  const [zoomedImage, setZoomedImage] = useState(null);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const loadFoldersWithItems = async () => {
    setIsLoading(true);
    setFeedback('');

    try {
      const folderRes = await paintingsApi.listMediaFolders(category);
      const loadedFolders = folderRes?.data?.data || [];
      setFolders(loadedFolders);

      const itemsEntries = await Promise.all(
        loadedFolders.map(async (folder) => {
          const itemsRes = await paintingsApi.listMediaItems(folder.id);
          return [folder.id, itemsRes?.data?.data || []];
        }),
      );

      const nextItemsByFolder = Object.fromEntries(itemsEntries);
      setItemsByFolder(nextItemsByFolder);

      setSlideByFolder((prev) => {
        const next = { ...prev };
        loadedFolders.forEach((folder) => {
          const items = nextItemsByFolder[folder.id] || [];
          const maxIndex = Math.max(items.length - 1, 0);
          next[folder.id] = Math.min(next[folder.id] || 0, maxIndex);
        });
        return next;
      });

      setRenameByFolder(Object.fromEntries(loadedFolders.map((folder) => [folder.id, folder.name || ''])));
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível carregar as pastas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFoldersWithItems();
  }, [category]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideByFolder((prev) => {
        const next = { ...prev };
        folders.forEach((folder) => {
          const items = itemsByFolder[folder.id] || [];
          if (items.length > 1) {
            next[folder.id] = ((next[folder.id] || 0) + 1) % items.length;
          }
        });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [folders, itemsByFolder]);

  const handleCreateFolder = async (e) => {
    e.preventDefault();

    if (!newFolderName.trim()) {
      setFeedback('Informe um nome para a pasta.');
      return;
    }

    try {
      await paintingsApi.createMediaFolder({ section_type: category, name: newFolderName.trim() });
      setNewFolderName('');
	  setCreateFolderModalOpen(false);
      setFeedback('Pasta criada com sucesso.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível criar a pasta.');
    }
  };

  const handleRenameFolder = async (folderId) => {
    const name = (renameByFolder[folderId] || '').trim();

    if (!name) {
      setFeedback('O novo nome da pasta não pode estar vazio.');
      return;
    }

    try {
      await paintingsApi.updateMediaFolder(folderId, { name });
      setFeedback('Nome da pasta atualizado.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível atualizar o nome da pasta.');
    }
  };

  const handleUploadItem = async (e) => {
    e.preventDefault();

    if (!selectedFolder) return;

    if (!uploadForm.title.trim() || !uploadForm.photo) {
      setFeedback('Preencha o título e selecione uma imagem para upload.');
      return;
    }

    try {
	  await paintingsApi.createMediaItem({
	  folder_id: selectedFolder.id,
      title: uploadForm.title.trim(),
      date: uploadForm.date || null,
      photo: uploadForm.photo,
	});	
      setUploadForm(emptyUploadForm);
      setFeedback('Imagem adicionada com sucesso.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível enviar a imagem.');
    }
  };
  
  const openImageViewer = (index) => {
  setActiveImageIndex(index);
};

const closeImageViewer = () => {
  setActiveImageIndex(null);
};

const goNext = () => {
  if (!selectedFolder) return;
  const items = itemsByFolder[selectedFolder.id] || [];
  setActiveImageIndex((prev) => (prev + 1) % items.length);
};

const goPrev = () => {
  if (!selectedFolder) return;
  const items = itemsByFolder[selectedFolder.id] || [];
  setActiveImageIndex((prev) =>
    prev === 0 ? items.length - 1 : prev - 1
  );
};

  return (
    <div className="card media-folder-section">
      <h2>{title}</h2>

<div style={{ marginTop: '12px' }}>
  <button
    type="button"
    className="btn btn-primary"
    onClick={() => setCreateFolderModalOpen(true)}
  >
    Nova pasta
  </button>
</div>

{createFolderModalOpen && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>Criar nova pasta</h3>

      <form onSubmit={handleCreateFolder} className="modal-form">
        <input
          className="input"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Nome da nova pasta"
          required
        />

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setCreateFolderModalOpen(false)}
          >
            Cancelar
          </button>

          <button type="submit" className="btn btn-primary">
            Criar pasta
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {!!feedback && <p className="media-folder-feedback">{feedback}</p>}
      {isLoading && <p className="media-folder-loading">Carregando pastas...</p>}

      <div className="media-folder-grid">
        {folders.map((folder) => {
          const items = itemsByFolder[folder.id] || [];
          const currentPreview = items[slideByFolder[folder.id] || 0];
          const previewUrl = resolveMediaUrl(currentPreview?.file_url, currentPreview?.file_path);

          return (
            <article key={folder.id} className="media-folder-card">
              <div className="media-folder-preview">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={currentPreview.title || folder.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoomedImage(previewUrl)}
                    onKeyDown={(e) => e.key === 'Enter' && setZoomedImage(previewUrl)}
                  />
                ) : (
                  <div className="media-folder-empty-preview">Sem imagens</div>
                )}
              </div>

              <h3>{folder.name}</h3>
              <p>{items.length} imagem(ns)</p>

              <div className="media-folder-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setSelectedFolderId(folder.id)}>
                  Abrir pasta
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading && !folders.length && <p className="media-folder-empty">Nenhuma pasta criada para esta categoria.</p>}

      {zoomedImage && (
        <div className="modal-backdrop modal-image-viewer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Visualização ampliada" className="modal-image-viewer-content" />
        </div>
      )}

{selectedFolder && (
  <div className="modal-backdrop dark-modal" onClick={() => setSelectedFolderId(null)}>
    <div className="modal-card media-gallery-modal" onClick={(e) => e.stopPropagation()}>

<div className="gallery-header">
  <div className="header-left" />
  
  <h3 className="gallery-title">{selectedFolder.name}</h3>

  <div className="header-actions">
    <button
      className="emoji-btn add"
      onClick={() => setUploadModalOpen(true)}
      title="Adicionar imagem"
    >
      +
    </button>

    <button
      className="emoji-btn delete"
      onClick={async () => {
        if (!window.confirm('Excluir esta pasta e todas as imagens?')) return;
        await paintingsApi.deleteMediaFolder(selectedFolder.id);
        setSelectedFolderId(null);
        await loadFoldersWithItems();
      }}
      title="Excluir pasta"
    >
      ✕
    </button>
  </div>
</div>

{/* Upload movido para modal discreto */}

      <div className="media-folder-items-grid dark-gallery-grid">
        {(itemsByFolder[selectedFolder.id] || []).map((item, index) => {
          const url = resolveMediaUrl(item.file_url, item.file_path);

          return (
            <article
              key={item.id}
              className="media-item-card dark-gallery-card"
              draggable
              onDragStart={(e) => e.currentTarget.classList.add('dragging')}
              onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
            >
              <div className="dark-image-wrapper">
                <img
                  loading="lazy"
                  src={url}
                  alt={item.title}
                  onClick={() => openImageViewer(index)}
                />
              </div>

<div className="gallery-item-footer">
  <div className="gallery-text">
    <span className="gallery-title-text">{item.title}</span>
    {item.date && (
      <span className="gallery-date-text">
        {new Date(item.date).toLocaleDateString('pt-BR')}
      </span>
    )}
  </div>

  <button
    className="delete-btn"
    onClick={async () => {
      if (!window.confirm('Excluir esta imagem?')) return;
      await paintingsApi.deleteMediaItem(item.id);
      await loadFoldersWithItems();
    }}
  >
    🗑
  </button>
</div>
            </article>
          );
        })}
      </div>
{uploadModalOpen && (
  <div className="mini-upload-overlay" onClick={() => setUploadModalOpen(false)}>
    <div className="mini-upload-card" onClick={(e) => e.stopPropagation()}>
      <h4>Adicionar imagem</h4>

      <form onSubmit={(e) => { handleUploadItem(e); setUploadModalOpen(false); }}>
<input
  className="input dark-input"
  value={uploadForm.title}
  onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
  placeholder="Título"
  required
/>

<input
  className="input dark-input"
  type="date"
  value={uploadForm.date}
  onChange={(e) => setUploadForm((prev) => ({ ...prev, date: e.target.value }))}
  required
/>
        <input
          className="input dark-input"
          type="file"
          accept="image/*"
          onChange={(e) => setUploadForm((prev) => ({ ...prev, photo: e.target.files?.[0] || null }))}
          required
        />
        <button className="btn btn-primary" type="submit">
          Adicionar
        </button>
      </form>
    </div>
  </div>
)}
    </div>
  </div>
)}
{activeImageIndex !== null && selectedFolder && (
  <div className="dark-viewer-overlay" onClick={closeImageViewer}>
    <button className="viewer-close" onClick={closeImageViewer}>✕</button>
    <button className="viewer-nav left" onClick={(e) => { e.stopPropagation(); goPrev(); }}>‹</button>
    <button className="viewer-nav right" onClick={(e) => { e.stopPropagation(); goNext(); }}>›</button>

    <img
      className="dark-viewer-image"
      src={resolveMediaUrl(
        itemsByFolder[selectedFolder.id][activeImageIndex]?.file_url,
        itemsByFolder[selectedFolder.id][activeImageIndex]?.file_path
      )}
      alt=""
      onClick={(e) => e.stopPropagation()}
    />
  </div>
)}
    </div>
  );
};

export default MediaFolderSection;
