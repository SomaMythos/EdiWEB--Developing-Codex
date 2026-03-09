import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '../utils/theme';

export default function Screen({ title, subtitle, children, refreshing, onRefresh }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={palette.highlight} /> : undefined
      }
    >
      <View style={styles.headerWrap}>
        <View style={styles.headerGlow} />
        <View style={styles.headerAccent} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 16,
  },
  headerWrap: {
    backgroundColor: palette.cardMuted,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    overflow: 'hidden',
    position: 'relative',
  },
  headerGlow: {
    position: 'absolute',
    top: -30,
    right: -10,
    width: 180,
    height: 120,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
  },
  headerAccent: {
    height: 5,
    backgroundColor: palette.accent,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
  },
});
