import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { calendarApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const emptyEvent = {
  id: null,
  date: todayIso(),
  title: '',
  description: '',
  start_time: '',
  end_time: '',
};

const emptyLog = {
  id: null,
  date: todayIso(),
  title: '',
  description: '',
};

export default function CalendarScreen() {
  const [date, setDate] = useState(todayIso());
  const [day, setDay] = useState(null);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [logForm, setLogForm] = useState(emptyLog);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await calendarApi.getDay(date);
      setDay(response?.data?.data || null);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar o calend\u00e1rio.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const submitEvent = async () => {
    const payload = { ...eventForm, date };
    if (!payload.title.trim()) return;
    try {
      if (payload.id) {
        await calendarApi.updateEvent(payload.id, payload);
      } else {
        await calendarApi.createEvent(payload);
      }
      setEventForm({ ...emptyEvent, date });
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel salvar o evento.');
    }
  };

  const submitLog = async () => {
    const payload = { ...logForm, date };
    if (!payload.title.trim()) return;
    try {
      if (payload.id) {
        await calendarApi.updateManualLog(payload.id, payload);
      } else {
        await calendarApi.createManualLog(payload);
      }
      setLogForm({ ...emptyLog, date });
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel salvar o registro.');
    }
  };

  return (
    <Screen title="Calend\u00e1rio" subtitle={date} refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.title}>Data</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} />
      </Card>

      <Card>
        <Text style={styles.title}>{eventForm.id ? 'Editar evento' : 'Novo evento'}</Text>
        <Text style={styles.helper}>Nome, hor\u00e1rio e descri\u00e7\u00e3o.</Text>
        <TextInput style={styles.input} value={eventForm.title} onChangeText={(value) => setEventForm((current) => ({ ...current, title: value }))} placeholder="Nome" placeholderTextColor={palette.muted} />
        <TextInput style={styles.input} value={eventForm.description} onChangeText={(value) => setEventForm((current) => ({ ...current, description: value }))} placeholder="Descri\u00e7\u00e3o" placeholderTextColor={palette.muted} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex]} value={eventForm.start_time} onChangeText={(value) => setEventForm((current) => ({ ...current, start_time: value }))} placeholder="In\u00edcio" placeholderTextColor={palette.muted} />
          <TextInput style={[styles.input, styles.flex]} value={eventForm.end_time} onChangeText={(value) => setEventForm((current) => ({ ...current, end_time: value }))} placeholder="Fim" placeholderTextColor={palette.muted} />
        </View>
        <Pressable style={styles.primaryButton} onPress={submitEvent}><Text style={styles.primaryText}>{eventForm.id ? 'Salvar' : 'Criar'}</Text></Pressable>
      </Card>

      <Card>
        <Text style={styles.title}>{logForm.id ? 'Editar anota\u00e7\u00e3o' : 'Nova anota\u00e7\u00e3o'}</Text>
        <Text style={styles.helper}>T\u00edtulo e descri\u00e7\u00e3o.</Text>
        <TextInput style={styles.input} value={logForm.title} onChangeText={(value) => setLogForm((current) => ({ ...current, title: value }))} placeholder="T\u00edtulo" placeholderTextColor={palette.muted} />
        <TextInput style={[styles.input, styles.multiline]} value={logForm.description} onChangeText={(value) => setLogForm((current) => ({ ...current, description: value }))} placeholder="Descri\u00e7\u00e3o" placeholderTextColor={palette.muted} multiline />
        <Pressable style={styles.secondaryButton} onPress={submitLog}><Text style={styles.secondaryText}>{logForm.id ? 'Salvar' : 'Criar'}</Text></Pressable>
      </Card>

      {(day?.events || []).map((event) => (
        <Card key={`event-${event.id}`}>
          <Text style={styles.entryTitle}>{event.title}</Text>
          <Text style={styles.entryMeta}>{event.start_time || 'Dia inteiro'} {event.end_time ? `\u2022 ${event.end_time}` : ''}</Text>
          <Pressable style={styles.ghostButton} onPress={() => setEventForm({
            id: event.id,
            date: event.date,
            title: event.title || '',
            description: event.description || '',
            start_time: event.start_time || '',
            end_time: event.end_time || '',
          })}>
            <Text style={styles.ghostText}>Editar</Text>
          </Pressable>
        </Card>
      ))}

      {(day?.manual_logs || []).map((log) => (
        <Card key={`log-${log.id}`}>
          <Text style={styles.entryTitle}>{log.title}</Text>
          <Text style={styles.entryMeta}>{log.description || 'Sem descri\u00e7\u00e3o'}</Text>
          <Pressable style={styles.ghostButton} onPress={() => setLogForm({
            id: log.id,
            date: log.date,
            title: log.title || '',
            description: log.description || '',
          })}>
            <Text style={styles.ghostText}>Editar</Text>
          </Pressable>
        </Card>
      ))}

      {(day?.automatic_logs || []).map((log) => (
        <Card key={log.id} style={styles.automaticCard}>
          <Text style={styles.entryTitle}>{log.title}</Text>
          <Text style={styles.entryMeta}>{log.event_type}</Text>
          <Text style={styles.entryMeta}>{log.description}</Text>
        </Card>
      ))}

      {(!day?.events?.length && !day?.manual_logs?.length && !day?.automatic_logs?.length) ? <Card><Text style={styles.entryMeta}>Nada nesta data.</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 18, fontWeight: '700' },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: palette.input, color: palette.text },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryButton: { backgroundColor: palette.accent, paddingVertical: 13, borderRadius: 16, alignItems: 'center' },
  secondaryButton: { backgroundColor: palette.cardAlt, paddingVertical: 13, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: palette.border },
  primaryText: { color: palette.accentText, fontWeight: '800' },
  secondaryText: { color: palette.text, fontWeight: '700' },
  ghostButton: { marginTop: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignSelf: 'flex-start', backgroundColor: palette.cardAlt },
  ghostText: { color: palette.text, fontWeight: '700' },
  entryTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  entryMeta: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  automaticCard: { backgroundColor: palette.accentSoft, borderColor: palette.borderStrong },
});
