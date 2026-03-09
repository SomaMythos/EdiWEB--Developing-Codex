import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { goalsApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

const initialForm = {
  title: '',
  description: '',
  deadline: '',
  difficulty: '1',
  categoryId: '',
};

export default function GoalsScreen() {
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [home, setHome] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [loading, setLoading] = useState(false);

  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(String(category.id), category));
    return map;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriesResponse, homeResponse] = await Promise.all([
        goalsApi.listCategories(),
        goalsApi.getHome(),
      ]);
      const nextCategories = categoriesResponse?.data?.data || [];
      setCategories(nextCategories);
      setHome(homeResponse?.data?.data || null);

      let goalsResponse;
      if (selectedCategoryId) {
        goalsResponse = await goalsApi.listByCategory(Number(selectedCategoryId));
      } else {
        goalsResponse = await goalsApi.list();
      }
      setGoals(goalsResponse?.data?.data || []);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar as metas.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingGoalId(null);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      deadline: form.deadline.trim() || null,
      difficulty: Number(form.difficulty || 1),
      category_id: form.categoryId ? Number(form.categoryId) : null,
    };

    try {
      if (editingGoalId) {
        await goalsApi.update(editingGoalId, payload);
      } else {
        await goalsApi.create(payload);
      }
      resetForm();
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel salvar a meta.');
    }
  };

  const startEditing = (goal) => {
    setEditingGoalId(goal.id);
    setForm({
      title: goal.title || '',
      description: goal.description || '',
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      difficulty: String(goal.difficulty || 1),
      categoryId: goal.category_id ? String(goal.category_id) : '',
    });
  };

  const concludeGoal = async (goalId) => {
    try {
      await goalsApi.updateStatus(goalId, 'concluida');
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail?.message || 'N\u00e3o foi poss\u00edvel concluir a meta.');
    }
  };

  const deleteGoal = async (goalId) => {
    Alert.alert('Excluir meta', 'Deseja realmente excluir esta meta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await goalsApi.remove(goalId);
            if (editingGoalId === goalId) {
              resetForm();
            }
            await load();
          } catch (error) {
            Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel excluir a meta.');
          }
        },
      },
    ]);
  };

  return (
    <Screen title="Metas" refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.title}>Vis\u00e3o geral</Text>
        <View style={styles.overviewRow}>
          <View style={styles.overviewChip}>
            <Text style={styles.overviewValue}>{home?.total_stars ?? 0}</Text>
            <Text style={styles.overviewLabel}>Estrelas</Text>
          </View>
          <View style={styles.overviewChip}>
            <Text style={styles.overviewValue}>{home?.recent_achievements?.length ?? 0}</Text>
            <Text style={styles.overviewLabel}>Recentes</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>Categorias</Text>
        <View style={styles.chipsWrap}>
          <Pressable style={[styles.chip, !selectedCategoryId && styles.chipActive]} onPress={() => setSelectedCategoryId('')}>
            <Text style={[styles.chipText, !selectedCategoryId && styles.chipTextActive]}>Todas</Text>
          </Pressable>
          {categories.map((category) => {
            const active = selectedCategoryId === String(category.id);
            return (
              <Pressable key={category.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setSelectedCategoryId(String(category.id))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>{editingGoalId ? 'Editar meta' : 'Nova meta'}</Text>
        <Text style={styles.helper}>Preencha s\u00f3 o necess\u00e1rio.</Text>
        <TextInput style={styles.input} value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="Nome" placeholderTextColor={palette.muted} />
        <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} placeholder="Descri\u00e7\u00e3o" placeholderTextColor={palette.muted} multiline />
        <TextInput style={styles.input} value={form.deadline} onChangeText={(value) => setForm((current) => ({ ...current, deadline: value }))} placeholder="Prazo (YYYY-MM-DD)" placeholderTextColor={palette.muted} />
        <TextInput style={styles.input} value={form.difficulty} onChangeText={(value) => setForm((current) => ({ ...current, difficulty: value }))} keyboardType="numeric" placeholder="Dificuldade" placeholderTextColor={palette.muted} />
        <Text style={styles.fieldLabel}>Categoria</Text>
        <View style={styles.chipsWrap}>
          <Pressable style={[styles.chip, !form.categoryId && styles.chipActive]} onPress={() => setForm((current) => ({ ...current, categoryId: '' }))}>
            <Text style={[styles.chipText, !form.categoryId && styles.chipTextActive]}>Sem categoria</Text>
          </Pressable>
          {categories.map((category) => {
            const active = form.categoryId === String(category.id);
            return (
              <Pressable key={category.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setForm((current) => ({ ...current, categoryId: String(category.id) }))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={submit}><Text style={styles.primaryText}>{editingGoalId ? 'Salvar' : 'Criar'}</Text></Pressable>
          {editingGoalId ? <Pressable style={styles.secondaryButton} onPress={resetForm}><Text style={styles.secondaryText}>Cancelar</Text></Pressable> : null}
        </View>
      </Card>

      {goals.map((goal) => {
        const categoryName = goal.category_id ? categoriesById.get(String(goal.category_id))?.name : null;
        return (
          <Card key={goal.id}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Text style={styles.goalMeta}>{goal.status} \u2022 dificuldade {goal.difficulty}</Text>
            <Text style={styles.goalMeta}>{categoryName || 'Sem categoria'}</Text>
            {goal.deadline ? <Text style={styles.goalMeta}>{goal.deadline.slice(0, 10)}</Text> : null}
            {goal.description ? <Text style={styles.goalDescription}>{goal.description}</Text> : null}
            <View style={styles.actions}>
              {goal.status !== 'concluida' ? <Pressable style={styles.secondaryButton} onPress={() => startEditing(goal)}><Text style={styles.secondaryText}>Editar</Text></Pressable> : null}
              {goal.status !== 'concluida' ? <Pressable style={styles.primaryButton} onPress={() => concludeGoal(goal.id)}><Text style={styles.primaryText}>Concluir</Text></Pressable> : null}
              <Pressable style={styles.dangerButton} onPress={() => deleteGoal(goal.id)}><Text style={styles.dangerText}>Excluir</Text></Pressable>
            </View>
          </Card>
        );
      })}

      {goals.length === 0 ? <Card><Text style={styles.goalMeta}>Nenhuma meta neste filtro.</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 18, fontWeight: '700' },
  overviewRow: { flexDirection: 'row', gap: 10 },
  overviewChip: {
    flex: 1,
    backgroundColor: palette.input,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  overviewValue: { color: palette.text, fontSize: 20, fontWeight: '800' },
  overviewLabel: { color: palette.muted, fontSize: 12 },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  fieldLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: palette.input, color: palette.text },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.chip },
  chipActive: { backgroundColor: palette.accentSoft, borderColor: palette.borderStrong },
  chipText: { color: palette.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: palette.highlight },
  goalTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  goalMeta: { color: palette.muted, fontSize: 13 },
  goalDescription: { color: palette.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  primaryButton: { backgroundColor: palette.accent, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  secondaryButton: { backgroundColor: palette.cardAlt, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: palette.border },
  dangerButton: { backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  primaryText: { color: palette.accentText, fontWeight: '800' },
  secondaryText: { color: palette.text, fontWeight: '700' },
  dangerText: { color: palette.danger, fontWeight: '700' },
});
