import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { dailyApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isCompleted(block) {
  return Boolean(block?.completed);
}

export default function DailyScreen() {
  const [date] = useState(todayIso());
  const [blocks, setBlocks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayResponse, summaryResponse] = await Promise.all([
        dailyApi.getByDate(date),
        dailyApi.getSummary(date),
      ]);
      setBlocks(dayResponse?.data?.data || []);
      setSummary(summaryResponse?.data?.data || null);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar o dia.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const generateDay = async () => {
    try {
      await dailyApi.generate(date);
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel gerar o plano do dia.');
    }
  };

  const toggleBlock = async (block) => {
    try {
      await dailyApi.completeBlock(block.id, !isCompleted(block));
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel atualizar o bloco.');
    }
  };

  return (
    <Screen title="Dia" subtitle={date} refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.sectionTitle}>Hoje</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{summary?.total_blocks ?? blocks.length}</Text>
            <Text style={styles.statLabel}>Blocos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{summary?.completed_blocks ?? blocks.filter(isCompleted).length}</Text>
            <Text style={styles.statLabel}>Feitos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{summary?.planned_minutes ?? 0}</Text>
            <Text style={styles.statLabel}>Min</Text>
          </View>
        </View>
        <Pressable style={styles.primaryButton} onPress={generateDay}>
          <Text style={styles.primaryText}>Gerar</Text>
        </Pressable>
      </Card>

      {blocks.map((block) => {
        const completed = isCompleted(block);
        return (
          <Card key={block.id} style={completed && styles.completedCard}>
            <Text style={styles.blockTitle}>{block.activity_title || block.block_name || 'Bloco'}</Text>
            <Text style={styles.meta}>{block.start_time || '--:--'} \u2022 {block.duration || 0} min</Text>
            {block.block_category ? <Text style={styles.meta}>{block.block_category}</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={() => toggleBlock(block)}>
              <Text style={styles.secondaryText}>{completed ? 'Reabrir' : 'Concluir'}</Text>
            </Pressable>
          </Card>
        );
      })}

      {blocks.length === 0 ? <Card><Text style={styles.meta}>Nenhum bloco hoje.</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1,
    backgroundColor: palette.input,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  statValue: { color: palette.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  blockTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  meta: { color: palette.muted, fontSize: 13 },
  primaryButton: { marginTop: 6, backgroundColor: palette.accent, paddingVertical: 13, borderRadius: 16, alignItems: 'center' },
  secondaryButton: { marginTop: 8, backgroundColor: palette.cardAlt, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: palette.border },
  primaryText: { color: palette.accentText, fontWeight: '800' },
  secondaryText: { color: palette.text, fontWeight: '700' },
  completedCard: { borderColor: palette.borderStrong },
});
