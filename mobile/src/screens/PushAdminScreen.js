import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { notificationsApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

const FILTERS = ['all', 'sent', 'failed', 'receipt_ok', 'receipt_error', 'dry_run'];

export default function PushAdminScreen() {
  const [devices, setDevices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionState, setActionState] = useState({ loading: false, message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deliveryParams = filter === 'all' ? { limit: 20 } : { limit: 20, status: filter };
      const [devicesResponse, deliveriesResponse] = await Promise.all([
        notificationsApi.listDevices(),
        notificationsApi.listPushDeliveries(deliveryParams),
      ]);
      setDevices(devicesResponse?.data?.data || []);
      setDeliveries(deliveriesResponse?.data?.data || []);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar os dados de push.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (request, successMessage) => {
    setActionState({ loading: true, message: '' });
    try {
      const response = await request();
      const payload = response?.data?.data;
      const details = payload ? ` ${JSON.stringify(payload)}` : '';
      setActionState({ loading: false, message: `${successMessage}.${details}` });
      await load();
    } catch (error) {
      setActionState({ loading: false, message: '' });
      Alert.alert('Erro', error?.response?.data?.detail || 'Falha ao executar a opera\u00e7\u00e3o de push.');
    }
  };

  const removeDevice = async (deviceToken) => {
    await runAction(() => notificationsApi.deleteDevice(deviceToken), 'Device removido');
  };

  return (
    <Screen title="Push" subtitle={actionState.message || undefined} refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.sectionTitle}>A\u00e7\u00f5es</Text>
        <Text style={styles.summary}>{devices.length} ativos</Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => runAction(() => notificationsApi.dispatchPush({ dry_run: true }), 'Dry run executado')}>
            <Text style={styles.secondaryText}>Dry run</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => runAction(() => notificationsApi.dispatchPush({ dry_run: false }), 'Dispatch executado')}>
            <Text style={styles.primaryText}>Disparar</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => runAction(() => notificationsApi.refreshPushReceipts({}), 'Receipts atualizados')}>
            <Text style={styles.secondaryText}>Receipts</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Filtro</Text>
        <View style={styles.filterWrap}>
          {FILTERS.map((option) => {
            const active = option === filter;
            return (
              <Pressable key={option} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(option)}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Devices</Text>
        {devices.length === 0 ? <Text style={styles.empty}>Nenhum device ativo.</Text> : null}
        {devices.map((device) => (
          <View key={device.id} style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{device.device_name || 'Device sem nome'}</Text>
              <Text style={styles.meta}>{device.platform || 'unknown'} \u2022 {device.device_token}</Text>
              <Text style={styles.meta}>{device.updated_at || device.created_at || 'n/d'}</Text>
            </View>
            <Pressable style={styles.dangerButton} onPress={() => removeDevice(device.device_token)}>
              <Text style={styles.dangerText}>Remover</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Entregas</Text>
        {deliveries.length === 0 ? <Text style={styles.empty}>Nenhuma entrega.</Text> : null}
        {deliveries.map((delivery) => (
          <View key={delivery.id} style={styles.deliveryRow}>
            <Text style={styles.rowTitle}>{delivery.notification_title || `Notification #${delivery.notification_id}`}</Text>
            <Text style={styles.meta}>{delivery.status} \u2022 {delivery.platform} \u2022 retry {delivery.retry_count ?? 0}</Text>
            <Text style={styles.meta}>device #{delivery.device_id} \u2022 {delivery.sent_at || 'n/d'}</Text>
            {delivery.ticket_id ? <Text style={styles.meta}>ticket: {delivery.ticket_id}</Text> : null}
            {delivery.receipt_id ? <Text style={styles.meta}>receipt: {delivery.receipt_id}</Text> : null}
            {delivery.error_message ? <Text style={styles.error}>{delivery.error_message}</Text> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const buttonBase = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 14,
};

const styles = StyleSheet.create({
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  summary: {
    color: palette.muted,
    fontSize: 14,
  },
  empty: {
    color: palette.muted,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    ...buttonBase,
    backgroundColor: palette.accent,
  },
  secondaryButton: {
    ...buttonBase,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  dangerButton: {
    ...buttonBase,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  primaryText: {
    color: palette.accentText,
    fontWeight: '800',
  },
  secondaryText: {
    color: palette.text,
    fontWeight: '700',
  },
  dangerText: {
    color: palette.danger,
    fontWeight: '700',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
  },
  filterChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.borderStrong,
  },
  filterText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: palette.highlight,
  },
  row: {
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  rowContent: {
    gap: 4,
  },
  deliveryRow: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
  },
});
