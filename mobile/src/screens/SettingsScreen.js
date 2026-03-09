import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { notificationsApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

const FEATURE_DEFS = [
  { key: 'goals', label: 'Metas' },
  { key: 'daily', label: 'Resumo di\u00e1rio' },
  { key: 'consumables', label: 'Consum\u00edveis' },
  { key: 'shopping', label: 'Compras' },
  { key: 'custom', label: 'Customizadas' },
];

const CHANNEL_DEFS = [
  { key: 'in_app', label: 'Inbox' },
  { key: 'sound', label: 'Som' },
  { key: 'push', label: 'Push' },
];

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.getPreferences();
      setPrefs(response?.data?.data || []);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar as prefer\u00eancias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const prefsByFeature = useMemo(() => {
    const mapped = new Map();
    prefs.forEach((item) => mapped.set(item.feature_key, item));
    return mapped;
  }, [prefs]);

  const getFeaturePref = (featureKey) => prefsByFeature.get(featureKey) || {
    feature_key: featureKey,
    enabled: true,
    channels: ['in_app', 'sound', 'push'],
    quiet_hours: null,
  };

  const savePrefs = async (nextPrefs) => {
    setPrefs(nextPrefs);
    setSaving(true);
    try {
      const response = await notificationsApi.savePreferences(nextPrefs);
      setPrefs(response?.data?.data || nextPrefs);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel salvar as prefer\u00eancias.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = async (featureKey, updater) => {
    const nextPrefs = FEATURE_DEFS.map((feature) => {
      const current = getFeaturePref(feature.key);
      return feature.key === featureKey ? updater({ ...current }) : { ...current };
    });
    await savePrefs(nextPrefs);
  };

  const toggleFeature = async (featureKey, enabled) => {
    await updateFeature(featureKey, (current) => ({ ...current, enabled }));
  };

  const toggleChannel = async (featureKey, channelKey) => {
    await updateFeature(featureKey, (current) => {
      if (!current.enabled) {
        return current;
      }

      const hasChannel = current.channels.includes(channelKey);
      const nextChannels = hasChannel
        ? current.channels.filter((item) => item !== channelKey)
        : [...current.channels, channelKey];
      return {
        ...current,
        channels: nextChannels,
      };
    });
  };

  return (
    <Screen title="Config" subtitle={saving ? 'Salvando\u2026' : undefined} refreshing={loading} onRefresh={load}>
      {FEATURE_DEFS.map((feature) => {
        const pref = getFeaturePref(feature.key);
        return (
          <Card key={feature.key}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.featureTitle}>{feature.label}</Text>
                <Text style={styles.meta}>{feature.key}</Text>
              </View>
              <Switch
                value={Boolean(pref.enabled)}
                onValueChange={(value) => toggleFeature(feature.key, value)}
                trackColor={{ false: palette.border, true: palette.accentSoft }}
                thumbColor={pref.enabled ? palette.highlight : palette.textSecondary}
              />
            </View>

            <View style={styles.channelsWrap}>
              {CHANNEL_DEFS.map((channel) => {
                const active = pref.channels.includes(channel.key);
                return (
                  <Pressable
                    key={channel.key}
                    style={[styles.channelChip, active && styles.channelChipActive, !pref.enabled && styles.channelChipDisabled]}
                    onPress={() => toggleChannel(feature.key, channel.key)}
                    disabled={saving || !pref.enabled}
                  >
                    <Text style={[styles.channelText, active && styles.channelTextActive]}>{channel.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  channelsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
  },
  channelChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.borderStrong,
  },
  channelChipDisabled: {
    opacity: 0.55,
  },
  channelText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  channelTextActive: {
    color: palette.highlight,
  },
});
