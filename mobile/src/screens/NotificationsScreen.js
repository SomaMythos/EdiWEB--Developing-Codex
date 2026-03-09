import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { notificationsApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.list({ include_read: true, include_generated: true });
      setItems(response?.data?.data || []);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar as notifica\u00e7\u00f5es.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (id, status) => {
    try {
      await notificationsApi.updateStatus(id, status);
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel atualizar a notifica\u00e7\u00e3o.');
    }
  };

  return (
    <Screen title="Inbox" refreshing={loading} onRefresh={load}>
      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.rowHeader}>
            <Text style={styles.title}>{item.title || 'Notifica\u00e7\u00e3o'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{item.source_feature || 'system'} \u2022 {item.severity || 'info'}</Text>
          <Text style={styles.message}>{item.message || 'Sem mensagem.'}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={() => changeStatus(item.id, 'read')}>
              <Text style={styles.secondaryText}>Lida</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => changeStatus(item.id, 'completed')}>
              <Text style={styles.primaryText}>Concluir</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      {items.length === 0 ? <Card><Text style={styles.empty}>Nada por aqui.</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { color: palette.text, fontSize: 17, fontWeight: '700', flex: 1 },
  badge: {
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: palette.highlight,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  meta: { color: palette.muted, fontSize: 12 },
  message: { color: palette.text, fontSize: 14, lineHeight: 20 },
  empty: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  primaryButton: { backgroundColor: palette.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  secondaryButton: { backgroundColor: palette.cardAlt, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: palette.border },
  primaryText: { color: palette.accentText, fontWeight: '800' },
  secondaryText: { color: palette.text, fontWeight: '700' },
});
