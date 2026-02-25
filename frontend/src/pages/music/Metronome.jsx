import { useState, useRef, useEffect } from "react";

export default function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subdivision, setSubdivision] = useState(1);

  const intervalRef = useRef(null);
  const beatRef = useRef(0);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  useEffect(() => {
    if (!audioCtxRef.current) return;

    if (isPlaying) {
      const interval = (60000 / bpm) / subdivision;

      intervalRef.current = setInterval(() => {
        playClick();
      }, interval);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, bpm, subdivision]);

  const playClick = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const isAccent = beatRef.current % subdivision === 0;

    osc.frequency.value = isAccent ? 1800 : 1400;
    osc.type = "triangle";

    const now = ctx.currentTime;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isAccent ? 0.2 : 0.12, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.start(now);
    osc.stop(now + 0.05);

    beatRef.current++;
  };

  return (
    <div className="metronome-horizontal">
      <span className="metro-label">Metronome</span>

      <input
        type="range"
        min="40"
        max="400"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="metro-slider"
      />

      <span className="metro-bpm">{bpm} BPM</span>

      <select
        value={subdivision}
        onChange={(e) => setSubdivision(Number(e.target.value))}
        className="metro-division"
      >
        <option value={1}>1/4</option>
        <option value={2}>1/8</option>
        <option value={4}>1/16</option>
        <option value={8}>1/32</option>
      </select>

      <button
        className={`btn btn-sm ${
          isPlaying ? "btn-danger" : "btn-primary"
        }`}
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? "Stop" : "Start"}
      </button>
    </div>
  );
}