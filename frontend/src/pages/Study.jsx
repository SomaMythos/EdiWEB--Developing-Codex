import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Link2,
  Plus,
  Save,
  Trash2,
  Video,
} from 'lucide-react';
import { studyApi } from '../services/api';
import './Study.css';

let youtubeApiPromise = null;

const EMPTY_TOPIC_FORM = {
  title: '',
  description: '',
};

const EMPTY_VIDEO_FORM = {
  title: '',
  source_url: '',
};

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatSeconds = (value) => {
  const total = Number(value) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const deriveTitleFromSourceUrl = (sourceUrl) => {
  if (!sourceUrl) return '';
  try {
    const parsed = new URL(sourceUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const rawSegment = segments[segments.length - 1] || '';
    return decodeURIComponent(rawSegment)
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (_) {
    return '';
  }
};

const isYoutubePlaceholderTitle = (video, title = video?.title) => {
  const normalized = (title || '').trim();
  if (!normalized || video?.provider !== 'youtube') return false;
  const videoId = extractYoutubeVideoId(video);
  return Boolean(videoId) && normalized.toLowerCase() === `youtube ${videoId}`.toLowerCase();
};

const fetchYoutubeTitle = async (sourceUrl) => {
  if (!sourceUrl || typeof window === 'undefined' || typeof window.fetch !== 'function') return '';
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`;
    const response = await window.fetch(endpoint);
    if (!response.ok) return '';
    const payload = await response.json();
    return (payload?.title || '').trim();
  } catch (_) {
    return '';
  }
};

const extractYoutubePlaylistId = (sourceUrl) => {
  if (!sourceUrl) return '';
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('youtube.com') && !host.includes('youtu.be')) return '';
    return parsed.searchParams.get('list') || '';
  } catch (_) {
    return '';
  }
};

const extractYoutubeVideoId = (video) => {
  const candidate = video?.embed_url || video?.source_url || '';
  const match = candidate.match(/\/embed\/([^?&/]+)/i);
  if (match?.[1]) return match[1];
  const fallback = candidate.match(/[?&]v=([^?&/]+)/i) || candidate.match(/youtu\.be\/([^?&/]+)/i);
  return fallback?.[1] || null;
};

const ensureYoutubeApi = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('window indisponível'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-study-youtube="true"]');
    const script = existingScript || document.createElement('script');
    if (!existingScript) {
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.studyYoutube = 'true';
      document.body.appendChild(script);
    }

    const timeoutId = window.setTimeout(() => reject(new Error('youtube-api-timeout')), 12000);
    const previousCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeoutId);
      if (typeof previousCallback === 'function') previousCallback();
      resolve(window.YT);
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('youtube-api-error'));
    };
  });

  return youtubeApiPromise;
};

function YoutubeStudyPlayer({ video, onProgress, onComplete, onTitleDetected }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const lastTickRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onTitleDetectedRef = useRef(onTitleDetected);
  const initialSecondsRef = useRef(Number(video?.current_seconds) || 0);
  const videoId = extractYoutubeVideoId(video);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onTitleDetectedRef.current = onTitleDetected;
  }, [onTitleDetected]);

  useEffect(() => {
    initialSecondsRef.current = Number(video?.current_seconds) || 0;
    lastTickRef.current = 0;
  }, [video?.id]);

  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;
    let cancelled = false;

    const clearProgressInterval = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    ensureYoutubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              const startSeconds = initialSecondsRef.current;
              const duration = Math.round(event.target.getDuration?.() || 0);
              const detectedTitle = event.target.getVideoData?.()?.title?.trim();
              if (detectedTitle && !video?.title) {
                onTitleDetectedRef.current?.(detectedTitle);
              }
              if (startSeconds > 0) {
                event.target.seekTo(startSeconds, true);
              }
              if (duration > 0) {
                onProgressRef.current?.({
                  current_seconds: startSeconds,
                  duration_seconds: duration,
                });
              }
            },
            onStateChange: (event) => {
              const state = event.data;
              if (state === window.YT.PlayerState.PLAYING) {
                clearProgressInterval();
                intervalRef.current = window.setInterval(() => {
                  const current = Math.round(event.target.getCurrentTime?.() || 0);
                  const duration = Math.round(event.target.getDuration?.() || 0);
                  if (current <= 0 || current === lastTickRef.current) return;
                  lastTickRef.current = current;
                  onProgressRef.current?.({
                    current_seconds: current,
                    duration_seconds: duration || undefined,
                  });
                }, 5000);
                return;
              }

              clearProgressInterval();
              if (state === window.YT.PlayerState.ENDED) {
                const duration = Math.round(event.target.getDuration?.() || 0);
                onCompleteRef.current?.({
                  current_seconds: duration || Number(video?.duration_seconds) || Number(video?.current_seconds) || 0,
                  duration_seconds: duration || undefined,
                });
              }
            },
          },
        });
      })
      .catch(() => {
        // fallback handled pela UI logo abaixo
      });

    return () => {
      cancelled = true;
      clearProgressInterval();
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, video?.id]);

  if (!videoId) {
    return (
      <div className="study-video-shell study-video-shell--unsupported">
        <p>Link sem suporte para incorporação automática.</p>
      </div>
    );
  }

  return <div ref={hostRef} className="study-video-shell" />;
}

function Html5StudyPlayer({ video, onProgress, onComplete, onTitleDetected }) {
  const lastTickRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onTitleDetectedRef = useRef(onTitleDetected);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onTitleDetectedRef.current = onTitleDetected;
  }, [onTitleDetected]);

  return (
    <video
      className="study-video-shell study-video-shell--native"
      controls
      preload="metadata"
      src={video.embed_url || video.source_url}
      onLoadedMetadata={(event) => {
        const startSeconds = Number(video?.current_seconds) || 0;
        if (startSeconds > 0 && event.currentTarget.duration > startSeconds) {
          event.currentTarget.currentTime = startSeconds;
        }
        if (!video?.title) {
          const inferredTitle = deriveTitleFromSourceUrl(video?.source_url);
          if (inferredTitle) {
            onTitleDetectedRef.current?.(inferredTitle);
          }
        }
        onProgressRef.current?.({
          current_seconds: Math.round(event.currentTarget.currentTime || 0),
          duration_seconds: Math.round(event.currentTarget.duration || 0),
        });
      }}
      onTimeUpdate={(event) => {
        const current = Math.round(event.currentTarget.currentTime || 0);
        if (current <= 0 || current === lastTickRef.current || current % 5 !== 0) return;
        lastTickRef.current = current;
        onProgressRef.current?.({
          current_seconds: current,
          duration_seconds: Math.round(event.currentTarget.duration || 0),
        });
      }}
      onEnded={(event) => {
        onCompleteRef.current?.({
          current_seconds: Math.round(event.currentTarget.duration || event.currentTarget.currentTime || 0),
          duration_seconds: Math.round(event.currentTarget.duration || 0),
        });
      }}
    />
  );
}

function VideoPlayerCard({
  video,
  draftNotes,
  onDraftNotesChange,
  onSaveNotes,
  onDelete,
  onToggleComplete,
  onProgress,
  onComplete,
  onTitleDetected,
}) {
  const isAutoProgress = video.provider === 'youtube' || video.provider === 'html5';

  return (
    <article className={`study-video-card page-shell ${video.is_completed ? 'is-completed' : ''}`}>
      <header className="study-video-card__head">
        <div>
          <span className="study-kicker">{video.provider === 'youtube' ? 'YouTube' : video.provider === 'html5' ? 'Vídeo direto' : 'Link externo'}</span>
          <h3>{video.display_title}</h3>
        </div>
        <div className="study-video-card__actions">
          <button
            type="button"
            className={`btn ${video.is_completed ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => onToggleComplete(video)}
          >
            {video.is_completed ? 'Reabrir' : 'Concluir'}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(video)}>
            Excluir
          </button>
        </div>
      </header>

      {video.provider === 'youtube' ? (
        <YoutubeStudyPlayer video={video} onProgress={onProgress} onComplete={onComplete} onTitleDetected={onTitleDetected} />
      ) : null}

      {video.provider === 'html5' ? (
        <Html5StudyPlayer video={video} onProgress={onProgress} onComplete={onComplete} onTitleDetected={onTitleDetected} />
      ) : null}

      {video.provider !== 'youtube' && video.provider !== 'html5' ? (
        <div className="study-video-shell study-video-shell--fallback">
          {video.embed_url ? (
            <iframe
              src={video.embed_url}
              title={video.display_title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="study-video-shell__fallback-copy">
              <Video size={24} />
              <p>Este link não oferece progresso automático dentro do app.</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="study-video-card__meta">
        <div className="study-progress">
          <div className="study-progress__bar">
            <span style={{ width: `${video.progress_percent || 0}%` }} />
          </div>
          <div className="study-progress__copy">
            <strong>{video.progress_percent || 0}% assistido</strong>
            <span>
              {video.duration_seconds
                ? `${formatSeconds(video.current_seconds || 0)} / ${formatSeconds(video.duration_seconds)}`
                : `${formatSeconds(video.current_seconds || 0)} assistidos`}
            </span>
          </div>
        </div>

        {video.is_completed ? (
          <div className="study-complete-badge">
            <CheckCircle2 size={16} />
            <span>Concluído em {formatDate(video.completed_at)}</span>
          </div>
        ) : null}

        {!isAutoProgress ? (
          <p className="study-muted">
            Progresso automático disponível para YouTube e arquivos de vídeo diretos.
          </p>
        ) : null}

        <div className="study-source-row">
          <Link2 size={15} />
          <a href={video.source_url} target="_blank" rel="noreferrer">
            Abrir link original
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="study-notes">
        <label htmlFor={`study-notes-${video.id}`}>Anotações</label>
        <textarea
          id={`study-notes-${video.id}`}
          className="input"
          rows={6}
          value={draftNotes}
          onChange={(event) => onDraftNotesChange(video.id, event.target.value)}
          placeholder="Escreva o que você aprendeu, pontos importantes, exemplos e detalhes para revisar depois."
        />
        <div className="study-notes__actions">
          <button type="button" className="btn btn-secondary" onClick={() => onSaveNotes(video)}>
            <Save size={15} />
            Salvar anotações
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Study() {
  const [topics, setTopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topicForm, setTopicForm] = useState(EMPTY_TOPIC_FORM);
  const [videoForm, setVideoForm] = useState(EMPTY_VIDEO_FORM);
  const [showTopicComposer, setShowTopicComposer] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [noteDrafts, setNoteDrafts] = useState({});
  const progressBufferRef = useRef(new Map());
  const progressTimerRef = useRef(new Map());
  const autoTitleRequestsRef = useRef(new Set());
  const youtubeTitleLookupsRef = useRef(new Set());

  const applyVideoLocally = (videoId, patch) => {
    setSelectedTopic((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        videos: (prev.videos || []).map((video) => (video.id === videoId ? { ...video, ...patch } : video)),
      };
    });
  };

  const loadTopics = async (preferredTopicId = null) => {
    setLoading(true);
    try {
      const response = await studyApi.listTopics();
      const topicList = response.data.data || [];
      setTopics(topicList);
      const nextTopicId = preferredTopicId ?? selectedTopicId ?? topicList[0]?.id ?? null;
      setSelectedTopicId(nextTopicId);
      if (nextTopicId) {
        const detail = await studyApi.getTopic(nextTopicId);
        setSelectedTopic(detail.data.data || null);
      } else {
        setSelectedTopic(null);
      }
    } catch (error) {
      console.error('Erro ao carregar estudo:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar o módulo de estudo.' });
    } finally {
      setLoading(false);
    }
  };

  const loadTopicDetail = async (topicId) => {
    if (!topicId) {
      setSelectedTopic(null);
      return;
    }
    try {
      const response = await studyApi.getTopic(topicId);
      setSelectedTopic(response.data.data || null);
    } catch (error) {
      console.error('Erro ao carregar assunto:', error);
      setFeedback({ type: 'error', message: 'Não foi possível abrir este assunto.' });
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (!selectedTopicId) return;
    if (selectedTopic?.id === selectedTopicId) return;
    loadTopicDetail(selectedTopicId);
  }, [selectedTopicId]);

  useEffect(() => {
    const nextDrafts = {};
    (selectedTopic?.videos || []).forEach((video) => {
      nextDrafts[video.id] = video.notes || '';
    });
    setNoteDrafts(nextDrafts);
  }, [selectedTopic]);

  useEffect(() => () => {
    progressTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
  }, []);

  useEffect(() => {
    (selectedTopic?.videos || []).forEach((video) => {
      if (video.provider !== 'youtube') return;
      if (!isYoutubePlaceholderTitle(video)) return;
      if (youtubeTitleLookupsRef.current.has(video.id)) return;

      youtubeTitleLookupsRef.current.add(video.id);
      fetchYoutubeTitle(video.source_url)
        .then((detectedTitle) => {
          if (detectedTitle) {
            handleAutoTitleDetected(video, detectedTitle);
          }
        })
        .finally(() => {
          youtubeTitleLookupsRef.current.delete(video.id);
        });
    });
  }, [selectedTopic]);

  const sortedTopics = useMemo(
    () => [...topics].sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0)),
    [topics],
  );

  const flushVideoProgress = async (videoId, immediatePatch = null) => {
    const pending = {
      ...(progressBufferRef.current.get(videoId) || {}),
      ...(immediatePatch || {}),
    };
    progressBufferRef.current.delete(videoId);
    const existingTimer = progressTimerRef.current.get(videoId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      progressTimerRef.current.delete(videoId);
    }
    if (!Object.keys(pending).length) return;

    try {
      const response = await studyApi.updateVideo(videoId, pending);
      const nextVideo = response.data.data;
      applyVideoLocally(videoId, nextVideo);
    } catch (error) {
      console.error('Erro ao salvar progresso do vídeo:', error);
    }
  };

  const queueVideoProgress = (videoId, patch, { immediate = false } = {}) => {
    const merged = {
      ...(progressBufferRef.current.get(videoId) || {}),
      ...patch,
    };
    progressBufferRef.current.set(videoId, merged);
    applyVideoLocally(videoId, merged);

    if (immediate) {
      flushVideoProgress(videoId);
      return;
    }

    if (progressTimerRef.current.has(videoId)) return;
    const timerId = window.setTimeout(() => flushVideoProgress(videoId), 1200);
    progressTimerRef.current.set(videoId, timerId);
  };

  const handleCreateTopic = async () => {
    if (!topicForm.title.trim()) return;
    try {
      const response = await studyApi.createTopic(topicForm);
      const nextTopic = response.data.data;
      setTopicForm(EMPTY_TOPIC_FORM);
      setShowTopicComposer(false);
      setFeedback({ type: 'success', message: 'Assunto criado com sucesso.' });
      await loadTopics(nextTopic.id);
    } catch (error) {
      console.error('Erro ao criar assunto:', error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Erro ao criar assunto.' });
    }
  };

  const handleDeleteTopic = async () => {
    if (!selectedTopic) return;
    if (!window.confirm(`Excluir o assunto "${selectedTopic.title}" e todos os vídeos dele?`)) return;
    try {
      await studyApi.deleteTopic(selectedTopic.id);
      const remainingTopicId = sortedTopics.find((topic) => topic.id !== selectedTopic.id)?.id ?? null;
      setFeedback({ type: 'success', message: 'Assunto removido.' });
      await loadTopics(remainingTopicId);
    } catch (error) {
      console.error('Erro ao excluir assunto:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir assunto.' });
    }
  };

  const handleCreateVideo = async () => {
    if (!selectedTopicId || !videoForm.source_url.trim()) return;
    const playlistId = extractYoutubePlaylistId(videoForm.source_url);
    try {
      if (playlistId) {
        const response = await studyApi.createPlaylist(selectedTopicId, { source_url: videoForm.source_url });
        const summary = response.data.data;
        const createdCount = Number(summary?.created_count || 0);
        const skippedCount = Number(summary?.skipped_count || 0);
        setFeedback({
          type: 'success',
          message: createdCount
            ? `Playlist importada com ${createdCount} vídeo${createdCount > 1 ? 's' : ''}${skippedCount ? ` e ${skippedCount} já existente${skippedCount > 1 ? 's' : ''}` : ''}.`
            : `Nenhum vídeo novo foi adicionado${skippedCount ? ' porque todos já existiam no assunto' : ''}.`,
        });
      } else {
        await studyApi.createVideo(selectedTopicId, videoForm);
        setFeedback({ type: 'success', message: 'Vídeo adicionado ao assunto.' });
      }
      setVideoForm(EMPTY_VIDEO_FORM);
      await loadTopicDetail(selectedTopicId);
      const topicsResponse = await studyApi.listTopics();
      setTopics(topicsResponse.data.data || []);
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Erro ao adicionar vídeo.' });
    }
  };

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Excluir "${video.display_title}" deste assunto?`)) return;
    try {
      await studyApi.deleteVideo(video.id);
      setFeedback({ type: 'success', message: 'Vídeo removido.' });
      await loadTopics(selectedTopicId);
    } catch (error) {
      console.error('Erro ao excluir vídeo:', error);
      setFeedback({ type: 'error', message: 'Erro ao excluir vídeo.' });
    }
  };

  const handleSaveNotes = async (video) => {
    try {
      const response = await studyApi.updateVideo(video.id, { notes: noteDrafts[video.id] || '' });
      applyVideoLocally(video.id, response.data.data);
      setFeedback({ type: 'success', message: 'Anotações salvas.' });
    } catch (error) {
      console.error('Erro ao salvar anotações:', error);
      setFeedback({ type: 'error', message: 'Erro ao salvar anotações.' });
    }
  };

  const handleToggleComplete = async (video) => {
    try {
      const response = await studyApi.updateVideo(video.id, { is_completed: !video.is_completed });
      applyVideoLocally(video.id, response.data.data);
      setFeedback({
        type: 'success',
        message: response.data.data.is_completed ? 'Vídeo concluído.' : 'Vídeo reaberto.',
      });
      const topicsResponse = await studyApi.listTopics();
      setTopics(topicsResponse.data.data || []);
    } catch (error) {
      console.error('Erro ao atualizar conclusão:', error);
      setFeedback({ type: 'error', message: 'Erro ao atualizar conclusão.' });
    }
  };

  const handleAutoTitleDetected = async (video, detectedTitle) => {
    const normalizedTitle = (detectedTitle || '').trim();
    const canOverwritePlaceholder = isYoutubePlaceholderTitle(video);
    if (!normalizedTitle) return;
    if (video?.title && !canOverwritePlaceholder) return;
    if (autoTitleRequestsRef.current.has(video.id)) return;

    autoTitleRequestsRef.current.add(video.id);
    applyVideoLocally(video.id, { title: normalizedTitle, display_title: normalizedTitle });
    try {
      const response = await studyApi.updateVideo(video.id, { title: normalizedTitle });
      applyVideoLocally(video.id, response.data.data);
    } catch (error) {
      console.error('Erro ao salvar título automático:', error);
    } finally {
      autoTitleRequestsRef.current.delete(video.id);
    }
  };

  return (
    <section className="study-page page-container fade-in">
      <header className="study-header">
        <div>
          <span className="study-kicker">Hobby</span>
          <h1>Estudo</h1>
          <p>Monte bibliotecas por assunto, assista vídeos direto na página e registre o que aprendeu em cada aula.</p>
        </div>
        <div className="study-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowTopicComposer((prev) => !prev)}>
            <Plus size={16} />
            Novo Assunto
          </button>
          {selectedTopic ? (
            <button type="button" className="btn btn-danger" onClick={handleDeleteTopic}>
              <Trash2 size={16} />
              Excluir assunto
            </button>
          ) : null}
        </div>
      </header>

      {feedback.message ? <div className={`study-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      <div className="study-layout">
        <aside className="study-sidebar page-shell">
          {showTopicComposer ? (
            <div className="study-composer">
              <label className="study-field">
                <span>Título</span>
                <input
                  className="input"
                  value={topicForm.title}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex.: React Compiler"
                />
              </label>
              <label className="study-field">
                <span>Descrição</span>
                <textarea
                  className="input"
                  rows={4}
                  value={topicForm.description}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Qual o foco desse assunto?"
                />
              </label>
              <div className="study-composer__actions">
                <button type="button" className="btn btn-primary" onClick={handleCreateTopic}>
                  Criar assunto
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTopicComposer(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <div className="study-sidebar__head">
            <div>
              <span className="study-kicker">Bibliotecas</span>
              <h2>Assuntos</h2>
            </div>
            <strong>{sortedTopics.length}</strong>
          </div>

          <div className="study-topic-list">
            {sortedTopics.length ? (
              sortedTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`study-topic-card ${selectedTopicId === topic.id ? 'active' : ''}`}
                  onClick={() => setSelectedTopicId(topic.id)}
                >
                  <div className="study-topic-card__copy">
                    <strong>{topic.title}</strong>
                    <span>{topic.description || 'Sem descrição por enquanto.'}</span>
                  </div>
                  <div className="study-topic-card__meta">
                    <span>{topic.completed_videos}/{topic.total_videos} concluídos</span>
                    <small>{formatDate(topic.updated_at || topic.created_at)}</small>
                  </div>
                </button>
              ))
            ) : (
              <div className="study-empty page-shell">
                <GraduationCap size={24} />
                <p>Nenhum assunto criado ainda.</p>
              </div>
            )}
          </div>
        </aside>

        <div className="study-main">
          {loading ? <div className="study-empty page-shell">Carregando módulo de estudo...</div> : null}

          {!loading && !selectedTopic ? (
            <div className="study-empty page-shell">
              <BookOpenText size={28} />
              <p>Crie um assunto para montar sua biblioteca de vídeos e anotações.</p>
            </div>
          ) : null}

          {!loading && selectedTopic ? (
            <>
              <section className="study-topic-hero page-shell">
                <div>
                  <span className="study-kicker">Assunto ativo</span>
                  <h2>{selectedTopic.title}</h2>
                  <p>{selectedTopic.description || 'Sem descrição definida para este assunto.'}</p>
                </div>
                <div className="study-topic-hero__stats">
                  <div className="study-stat-pill">
                    <strong>{selectedTopic.total_videos || 0}</strong>
                    <span>vídeos</span>
                  </div>
                  <div className="study-stat-pill">
                    <strong>{selectedTopic.started_videos || 0}</strong>
                    <span>em andamento</span>
                  </div>
                  <div className="study-stat-pill">
                    <strong>{selectedTopic.completed_videos || 0}</strong>
                    <span>concluídos</span>
                  </div>
                </div>
              </section>

              <section className="study-add-video page-shell">
                <div className="study-add-video__head">
                  <div>
                    <span className="study-kicker">Biblioteca</span>
                    <h3>Adicionar vídeo</h3>
                  </div>
                </div>
                <div className="study-add-video__grid">
                  <label className="study-field">
                    <span>Título opcional</span>
                    <input
                      className="input"
                      value={videoForm.title}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Ex.: Aula 01 - Hooks assínc."
                    />
                  </label>
                  <label className="study-field study-field--wide">
                    <span>Link do vídeo</span>
                    <input
                      className="input"
                      value={videoForm.source_url}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, source_url: event.target.value }))}
                      placeholder="Cole aqui um link de vídeo ou playlist do YouTube, Vimeo ou vídeo direto"
                    />
                  </label>
                  <div className="study-add-video__actions">
                    <button type="button" className="btn btn-primary" onClick={handleCreateVideo}>
                      <Plus size={16} />
                      Adicionar vídeo
                    </button>
                  </div>
                </div>
              </section>

              <div className="study-video-list">
                {(selectedTopic.videos || []).length ? (
                  selectedTopic.videos.map((video) => (
                    <VideoPlayerCard
                      key={video.id}
                      video={video}
                      draftNotes={noteDrafts[video.id] ?? ''}
                      onDraftNotesChange={(videoId, value) => setNoteDrafts((prev) => ({ ...prev, [videoId]: value }))}
                      onSaveNotes={handleSaveNotes}
                      onDelete={handleDeleteVideo}
                      onToggleComplete={handleToggleComplete}
                      onProgress={(payload) => queueVideoProgress(video.id, payload)}
                      onComplete={(payload) => queueVideoProgress(video.id, { ...payload, is_completed: true }, { immediate: true })}
                      onTitleDetected={(detectedTitle) => handleAutoTitleDetected(video, detectedTitle)}
                    />
                  ))
                ) : (
                  <div className="study-empty page-shell">
                    <Video size={26} />
                    <p>Este assunto ainda não tem vídeos. Adicione o primeiro acima.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
