import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { financeApi } from '../api/services';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { palette } from '../utils/theme';

const initialSpend = {
  description: '',
  amount: '',
  category: '',
};

export default function FinanceScreen() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [spend, setSpend] = useState(initialSpend);
  const [loading, setLoading] = useState(false);

  const expenses = useMemo(() => transactions.filter((item) => item.kind === 'expense'), [transactions]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([
        financeApi.getSummary(),
        financeApi.listTransactions(20),
      ]);
      setSummary(summaryResponse?.data?.data || null);
      setTransactions(transactionsResponse?.data?.data || []);
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitSpend = async () => {
    const amount = Number(spend.amount);
    if (!spend.description.trim() || !amount || amount <= 0) return;

    try {
      await financeApi.spend({
        description: spend.description.trim(),
        amount,
        category: spend.category.trim() || 'avulso',
        occurred_at: new Date().toISOString(),
      });

      setSpend(initialSpend);
      await load();
    } catch (error) {
      Alert.alert('Erro', error?.response?.data?.detail || 'N\u00e3o foi poss\u00edvel registrar o gasto.');
    }
  };

  return (
    <Screen title="Financeiro" refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.title}>Resumo</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Patrim\u00f4nio</Text>
            <Text style={styles.summaryValue}>{summary?.patrimonio_total ?? 0}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={styles.summaryValue}>{summary?.current ?? 0}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Livre</Text>
            <Text style={styles.summaryValue}>{summary?.saldo_disponivel ?? 0}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Sa\u00fade</Text>
            <Text style={styles.summaryValue}>{summary?.health_indicator || '-'}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>Gasto r\u00e1pido</Text>
        <Text style={styles.helper}>Descri\u00e7\u00e3o, valor e categoria.</Text>
        <TextInput style={styles.input} value={spend.description} onChangeText={(value) => setSpend((current) => ({ ...current, description: value }))} placeholder="Descri\u00e7\u00e3o" placeholderTextColor={palette.muted} />
        <TextInput style={styles.input} value={spend.amount} onChangeText={(value) => setSpend((current) => ({ ...current, amount: value }))} keyboardType="decimal-pad" placeholder="Valor" placeholderTextColor={palette.muted} />
        <TextInput style={styles.input} value={spend.category} onChangeText={(value) => setSpend((current) => ({ ...current, category: value }))} placeholder="Categoria" placeholderTextColor={palette.muted} />
        <Pressable style={styles.primaryButton} onPress={submitSpend}><Text style={styles.primaryText}>Registrar</Text></Pressable>
      </Card>

      {expenses.map((item) => (
        <Card key={item.id}>
          <View style={styles.entryHeader}>
            <Text style={styles.transactionTitle}>{item.description}</Text>
            <Text style={styles.transactionAmount}>R$ {item.amount}</Text>
          </View>
          <Text style={styles.transactionMeta}>{item.category || 'sem categoria'} \u2022 {item.occurred_at}</Text>
        </Card>
      ))}

      {expenses.length === 0 ? <Card><Text style={styles.transactionMeta}>Nenhum gasto recente.</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 18, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryItem: {
    width: '47%',
    backgroundColor: palette.input,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  summaryLabel: { color: palette.muted, fontSize: 12 },
  summaryValue: { color: palette.text, fontSize: 18, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: palette.input, color: palette.text },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  primaryButton: { backgroundColor: palette.accent, paddingVertical: 13, borderRadius: 16, alignItems: 'center' },
  primaryText: { color: palette.accentText, fontWeight: '800' },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  transactionTitle: { color: palette.text, fontWeight: '700', fontSize: 16, flex: 1 },
  transactionMeta: { color: palette.muted, fontSize: 13 },
  transactionAmount: { color: palette.highlight, fontWeight: '800', fontSize: 18 },
});
