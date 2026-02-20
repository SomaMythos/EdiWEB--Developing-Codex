import React, { useEffect, useState } from 'react';
import { remindersApi, dayPlanApi } from '../services/api';
import './Reminders.css';

const Reminders = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [reminders, setReminders] = useState([]);
  const [plan, setPlan] = useState([]);
  const [title, setTitle] = useState('');

  const load = async () => {
    const [r, p] = await Promise.all([remindersApi.list(), dayPlanApi.list(today)]);
    setReminders(r.data.data || []);
    setPlan(p.data.data || []);
  };

  useEffect(() => { load(); }, []);

  const addReminder = async (e) => {
    e.preventDefault();
    await remindersApi.create({ title });
    setTitle('');
    load();
  };

  return <div className="page-container fade-in reminders-page"><h1>Lembretes & Plano do Dia</h1><form onSubmit={addReminder} className="card reminders-card"><input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Novo lembrete" required /><button className="btn btn-primary">Salvar</button></form><div className="card reminders-card"><h3>Lembretes pendentes</h3>{reminders.map(r=><div key={r.id}>{r.title}</div>)}</div><div className="card reminders-card"><h3>Blocos de hoje</h3>{plan.map(b=><div key={b.id}>{b.start_time} - {b.duration} min</div>)}</div></div>;
};

export default Reminders;
