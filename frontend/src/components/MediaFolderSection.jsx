import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, PencilLine, Trash2, X } from 'lucide-react';
import { paintingsApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './MediaFolderSection.css';

const emptyUploadForm = { title: '', date: '', photo: null };

const MediaFolderSection = ({ category, title, uiMode = 'view' }) => {
  const [folders, setFolders] = useState([]);
  const [itemsByFolder, setItemsByFolder] = useState({});
  const [slideByFolder, setSlideByFolder] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [renameValue, setRenameValue] = useState('');
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(null);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const selectedFolderItems = useMemo(
    () => (selectedFolder ? itemsByFolder[selectedFolder.id] || [] : []),
    [itemsByFolder, selectedFolder],
  );

  const totalItems = useMemo(
    () => folders.reduce((count, folder) => count + ((itemsByFolder[folder.id] || []).length), 0),
    [folders, itemsByFolder],
  );

  const loadFoldersWithItems = async () => {
    setIsLoading(true);
    setFeedback('');

    try {
      const folderResponse = await paintingsApi.listMediaFolders(category);
      const loadedFolders = folderResponse?.data?.data || [];
      setFolders(loadedFolders);

      const itemEntries = await Promise.all(
        loadedFolders.map(async (folder) => {
          const itemsResponse = await paintingsApi.listMediaItems(folder.id);
          return [folder.id, itemsResponse?.data?.data || []];
        }),
      );

      const nextItemsByFolder = Object.fromEntries(itemEntries);
      setItemsByFolder(nextItemsByFolder);

      setSlideByFolder((previous) => {
        const next = { ...previous };
        loadedFolders.forEach((folder) => {
          const items = nextItemsByFolder[folder.id] || [];
          const maxIndex = Math.max(items.length - 1, 0);
          next[folder.id] = Math.min(next[folder.id] || 0, maxIndex);
        });
        return next;
      });
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
    if (!folders.length) return undefined;

    const interval = setInterval(() => {
      setSlideByFolder((previous) => {
        const next = { ...previous };
        folders.forEach((folder) => {
          const items = itemsByFolder[folder.id] || [];
          if (items.length > 1) {
            next[folder.id] = ((next[folder.id] || 0) + 1) % items.length;
          }
        });
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [folders, itemsByFolder]);

  useEffect(() => {
    setRenameValue(selectedFolder?.name || '');
  }, [selectedFolder]);

  const handleCreateFolder = async (event) => {
    event.preventDefault();
    if (!newFolderName.trim()) return;

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

  const handleRenameFolder = async () => {
    if (!selectedFolder || !renameValue.trim()) return;

    try {
      await paintingsApi.updateMediaFolder(selectedFolder.id, { name: renameValue.trim() });
      setFeedback('Nome atualizado.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível atualizar o nome da pasta.');
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    if (!window.confirm('Excluir esta pasta e todas as imagens?')) return;

    try {
      await paintingsApi.deleteMediaFolder(selectedFolder.id);
      setSelectedFolderId(null);
      setFeedback('Pasta excluída.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível excluir a pasta.');
    }
  };

  const handleUploadItem = async (event) => {
    event.preventDefault();
    if (!selectedFolder || !uploadForm.title.trim() || !uploadForm.photo) return;

    try {
      await paintingsApi.createMediaItem({
        folder_id: selectedFolder.id,
        title: uploadForm.title.trim(),
        date: uploadForm.date || null,
        photo: uploadForm.photo,
      });
      setUploadForm(emptyUploadForm);
      setUploadModalOpen(false);
      setFeedback('Imagem adicionada com sucesso.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível enviar a imagem.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Excluir esta imagem?')) return;

    try {
      await paintingsApi.deleteMediaItem(itemId);
      setFeedback('Imagem excluída.');
      await loadFoldersWithItems();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível excluir a imagem.');
    }
  };

  const openImageViewer = (index) => setActiveImageIndex(index);
  const closeImageViewer = () => setActiveImageIndex(null);

  const goToImage = (direction) => {
    if (!selectedFolderItems.length) return;
    setActiveImageIndex((previous) => {
      const current = previous ?? 0;
      return (current + direction + selectedFolderItems.length) % selectedFolderItems.length;
    });
  };

  return (
    <section className="media-folder-section">
      <div className="media-folder-head">
        <div className="media-folder-pills">
          <div className="media-folder-pill page-shell">
            <span>Pastas</span>
            <strong>{folders.length}</strong>
          </div>
          <div className="media-folder-pill page-shell">
            <span>Imagens</span>
            <strong>{totalItems}</strong>
          </div>
        </div>

        {uiMode === 'edit' ? (
          <button type="button" className="btn btn-primary" onClick={() => setCreateFolderModalOpen(true)}>
            <ImagePlus size={16} /> Nova pasta
          </button>
        ) : null}
      </div>

      {feedback ? <div className="media-folder-feedback">{feedback}</div> : null}
      {isLoading ? <div className="visual-empty-state page-shell">Carregando acervo...</div> : null}

      {!isLoading && folders.length ? (
        <div className="media-folder-grid">
          {folders.map((folder) => {
            const items = itemsByFolder[folder.id] || [];
            const currentPreview = items[slideByFolder[folder.id] || 0];
            const previewUrl = resolveMediaUrl(currentPreview?.file_url, currentPreview?.file_path);

            return (
              <article key={folder.id} className="media-folder-card page-shell" onClick={() => setSelectedFolderId(folder.id)}>
                <div className="media-folder-preview">
                  {previewUrl ? (
                    <img src={previewUrl} alt={currentPreview?.title || folder.name} />
                  ) : (
                    <div className="media-folder-empty-preview">
                      <span>{folder.name}</span>
                    </div>
                  )}
                </div>

                <div className="media-folder-card-copy">
                  <strong>{folder.name}</strong>
                  <span>{items.length} imagem(ns)</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!isLoading && !folders.length ? (
        <div className="visual-empty-state page-shell">
          <span className="visual-kicker">Acervo</span>
          <h3>Nenhuma pasta criada em {title.toLowerCase()}.</h3>
          {uiMode === 'edit' ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateFolderModalOpen(true)}>
              <ImagePlus size={16} /> Criar pasta
            </button>
          ) : null}
        </div>
      ) : null}

      {createFolderModalOpen ? (
        <div className="modal-backdrop" onClick={() => setCreateFolderModalOpen(false)}>
          <div className="modal-card media-folder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="visual-modal-head">
              <div>
                <span className="visual-kicker">Nova pasta</span>
                <h2>{title}</h2>
              </div>
            </div>

            <form onSubmit={handleCreateFolder} className="modal-form visual-modal-form">
              <label>
                Nome
                <input
                  className="input"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setCreateFolderModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedFolder ? (
        <div className="modal-backdrop" onClick={() => setSelectedFolderId(null)}>
          <div className="modal-card media-gallery-modal" onClick={(event) => event.stopPropagation()}>
            <div className="visual-modal-head">
              <div>
                <span className="visual-kicker">Pasta</span>
                <h2>{selectedFolder.name}</h2>
              </div>

              <div className="media-gallery-actions">
                {uiMode === 'edit' ? (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setUploadModalOpen(true)}>
                      <ImagePlus size={15} /> Adicionar
                    </button>
                    <button type="button" className="btn btn-danger" onClick={handleDeleteFolder}>
                      <Trash2 size={15} /> Excluir pasta
                    </button>
                  </>
                ) : null}

                <button type="button" className="btn btn-ghost" onClick={() => setSelectedFolderId(null)}>
                  <X size={15} /> Fechar
                </button>
              </div>
            </div>

            {uiMode === 'edit' ? (
              <div className="media-folder-rename page-shell">
                <label>
                  Nome da pasta
                  <input className="input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                </label>
                <button type="button" className="btn btn-secondary" onClick={handleRenameFolder}>
                  <PencilLine size={15} /> Salvar nome
                </button>
              </div>
            ) : null}

            {selectedFolderItems.length ? (
              <div className="media-folder-items-grid glass-scrollbar">
                {selectedFolderItems.map((item, index) => {
                  const url = resolveMediaUrl(item.file_url, item.file_path);
                  return (
                    <article key={item.id} className="media-item-card elevation-1">
                      <button type="button" className="media-item-image-button" onClick={() => openImageViewer(index)}>
                        <img src={url} alt={item.title} />
                      </button>

                      <div className="media-item-footer">
                        <div className="media-item-copy">
                          <strong>{item.title}</strong>
                          <span>{item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                        </div>

                        {uiMode === 'edit' ? (
                          <button type="button" className="btn btn-danger" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="visual-empty-state page-shell">
                <span className="visual-kicker">Pasta vazia</span>
                <h3>Nenhuma imagem adicionada ainda.</h3>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {uploadModalOpen && selectedFolder ? (
        <div className="modal-backdrop" onClick={() => setUploadModalOpen(false)}>
          <div className="modal-card media-folder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="visual-modal-head">
              <div>
                <span className="visual-kicker">Adicionar imagem</span>
                <h2>{selectedFolder.name}</h2>
              </div>
            </div>

            <form onSubmit={handleUploadItem} className="modal-form visual-modal-form">
              <label>
                Título
                <input
                  className="input"
                  value={uploadForm.title}
                  onChange={(event) => setUploadForm((previous) => ({ ...previous, title: event.target.value }))}
                  required
                />
              </label>

              <label>
                Data
                <input
                  className="input"
                  type="date"
                  value={uploadForm.date}
                  onChange={(event) => setUploadForm((previous) => ({ ...previous, date: event.target.value }))}
                />
              </label>

              <label>
                Arquivo
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setUploadForm((previous) => ({ ...previous, photo: event.target.files?.[0] || null }))}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setUploadModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeImageIndex !== null && selectedFolderItems[activeImageIndex] ? (
        <div className="modal-backdrop modal-image-viewer" onClick={closeImageViewer}>
          <button type="button" className="media-viewer-nav left" onClick={(event) => { event.stopPropagation(); goToImage(-1); }}>
            ‹
          </button>
          <img
            src={resolveMediaUrl(selectedFolderItems[activeImageIndex].file_url, selectedFolderItems[activeImageIndex].file_path)}
            alt={selectedFolderItems[activeImageIndex].title}
            className="modal-image-viewer-content"
            onClick={(event) => event.stopPropagation()}
          />
          <button type="button" className="media-viewer-nav right" onClick={(event) => { event.stopPropagation(); goToImage(1); }}>
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default MediaFolderSection;
