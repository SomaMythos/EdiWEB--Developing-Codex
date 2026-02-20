import React, { useEffect, useState } from 'react';
import { paintingsApi } from '../services/api';

const sharedArtworkFlow = new Set(['pintura', 'pintura_digital', 'desenho_tradicional']);

const ArtworkSection = ({ category, title }) => {
  const [artworks, setArtworks] = useState([]);
  const [form, setForm] = useState({ title: '', size: '', started_at: '', referenceFile: null, updateTitle: '' });
  const [progressForm, setProgressForm] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requiresStartedAt = sharedArtworkFlow.has(category);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await paintingsApi.list(undefined, category);
      setArtworks(res.data.data || []);
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível carregar as obras dessa categoria.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [category]);

  const createArtwork = async (e) => {
    e.preventDefault();
    setFeedback('');

    if (requiresStartedAt && !form.started_at) {
      setFeedback('Informe a data de início para criar obras nessa categoria.');
      return;
    }

    try {
      await paintingsApi.create({
        title: form.title,
        size: form.size,
        started_at: form.started_at,
        category,
        reference_image: form.referenceFile,
      });
      setForm({ title: '', size: '', started_at: '', referenceFile: null, updateTitle: '' });
      setFeedback('Obra criada com sucesso.');
      await load();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível criar a obra.');
    }
  };

  const addProgress = async (paintingId) => {
    const data = progressForm[paintingId] || { photoFile: null, notes: '' };
    try {
      await paintingsApi.addProgress(paintingId, {
        photo: data.photoFile,
        update_title: data.notes || 'Atualização de progresso',
      });
      setProgressForm((prev) => ({ ...prev, [paintingId]: { photoFile: null, notes: '' } }));
      setFeedback('Progresso registrado.');
      await load();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Envie uma foto para registrar o progresso.');
    }
  };

  const completeArtwork = async (paintingId) => {
    try {
      await paintingsApi.complete(paintingId);
      setFeedback('Obra concluída com sucesso.');
      await load();
    } catch (error) {
      setFeedback(error?.response?.data?.detail || 'Não foi possível concluir a obra.');
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>

      <form onSubmit={createArtwork} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Título da obra"
          required
        />
        <input
          className="input"
          value={form.size}
          onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
          placeholder="Tamanho (opcional)"
        />
        <input
          className="input"
          type="date"
          value={form.started_at}
          onChange={(e) => setForm((prev) => ({ ...prev, started_at: e.target.value }))}
          required={requiresStartedAt}
        />
        <input
          className="input"
          type="file"
          accept="image/*"
          onChange={(e) => setForm((prev) => ({ ...prev, referenceFile: e.target.files?.[0] || null }))}
        />
        <button className="btn btn-primary" type="submit">Criar obra</button>
      </form>

      {!!feedback && <p style={{ marginBottom: 12, opacity: 0.9 }}>{feedback}</p>}
      {isLoading && <p style={{ marginBottom: 12, opacity: 0.7 }}>Carregando...</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {artworks.map((artwork) => {
          const currentProgress = progressForm[artwork.id] || { photoFile: null, notes: '' };
          return (
            <div key={artwork.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
              <strong>{artwork.title}</strong>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                Status: {artwork.status} • Tempo: {artwork.time_spent || 0} min • Fotos: {artwork.photos_count || 0}
              </div>

              {artwork.status !== 'concluído' && (
                <>
                  <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setProgressForm((prev) => ({
                          ...prev,
                          [artwork.id]: { ...currentProgress, photoFile: e.target.files?.[0] || null },
                        }))
                      }
                    />
                    <input
                      className="input"
                      value={currentProgress.notes}
                      onChange={(e) =>
                        setProgressForm((prev) => ({
                          ...prev,
                          [artwork.id]: { ...currentProgress, notes: e.target.value },
                        }))
                      }
                      placeholder="Notas"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" type="button" onClick={() => addProgress(artwork.id)}>
                      Registrar progresso
                    </button>
                    <button className="btn btn-success" type="button" onClick={() => completeArtwork(artwork.id)}>
                      Concluir
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {!artworks.length && !isLoading && <p style={{ opacity: 0.7 }}>Nenhuma obra cadastrada para esta categoria.</p>}
      </div>
    </div>
  );
};

export default ArtworkSection;
