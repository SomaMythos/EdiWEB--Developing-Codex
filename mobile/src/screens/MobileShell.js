import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import DailyScreen from './DailyScreen';
import NotificationsScreen from './NotificationsScreen';
import GoalsScreen from './GoalsScreen';
import FinanceScreen from './FinanceScreen';
import CalendarScreen from './CalendarScreen';
import PushAdminScreen from './PushAdminScreen';
import SettingsScreen from './SettingsScreen';
import { palette } from '../utils/theme';

const tabs = [
  { key: 'notifications', label: 'Inbox' },
  { key: 'daily', label: 'Dia' },
  { key: 'goals', label: 'Metas' },
  { key: 'finance', label: 'Financeiro' },
  { key: 'calendar', label: 'Calend\u00e1rio' },
  { key: 'settings', label: 'Config' },
];

const pushLabels = {
  idle: 'Push ocioso',
  syncing: 'Sincronizando push',
  registered: 'Push ativo',
  unavailable: 'Push indispon\u00edvel',
};

export default function MobileShell() {
  const [activeTab, setActiveTab] = useState('notifications');
  const [showPushAdmin, setShowPushAdmin] = useState(false);
  const { logout, pushState } = useAuth();

  const ScreenComponent = useMemo(() => {
    if (showPushAdmin) {
      return PushAdminScreen;
    }

    switch (activeTab) {
      case 'daily':
        return DailyScreen;
      case 'goals':
        return GoalsScreen;
      case 'finance':
        return FinanceScreen;
      case 'calendar':
        return CalendarScreen;
      case 'settings':
        return SettingsScreen;
      default:
        return NotificationsScreen;
    }
  }, [activeTab, showPushAdmin]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>EDI Mobile</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.pushState}>{pushLabels[pushState.status] || 'Push'}</Text>
          </View>
        </View>
        <View style={styles.topActions}>
          <Pressable onPress={() => setShowPushAdmin((current) => !current)} style={styles.utilityButton}>
            <Text style={styles.utilityText}>{showPushAdmin ? 'Voltar' : 'Push'}</Text>
          </Pressable>
          <Pressable onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <ScreenComponent />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab && !showPushAdmin;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setShowPushAdmin(false);
                setActiveTab(tab.key);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.cardMuted,
  },
  brandBlock: {
    gap: 6,
  },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  pushState: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  utilityButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  utilityText: {
    color: palette.text,
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  logoutText: {
    color: palette.text,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.cardMuted,
    gap: 8,
  },
  tab: {
    flexGrow: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.borderStrong,
  },
  tabLabel: {
    color: palette.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  tabLabelActive: {
    color: palette.highlight,
  },
});
