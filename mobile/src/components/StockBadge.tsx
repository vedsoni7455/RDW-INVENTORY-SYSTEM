import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StockBadgeProps {
  status: 'OK' | 'LOW STOCK' | 'OUT OF STOCK' | 'SUFFICIENT';
  size?: 'sm' | 'md';
}

export const StockBadge: React.FC<StockBadgeProps> = ({ status, size = 'sm' }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'OK':
      case 'SUFFICIENT':
        return {
          bg: '#042f2e',
          text: '#34d399',
          border: '#0d9488',
          dot: '#10b981',
          label: 'SUFFICIENT',
        };
      case 'LOW STOCK':
        return {
          bg: '#451a03',
          text: '#fbbf24',
          border: '#d97706',
          dot: '#f59e0b',
          label: 'LOW STOCK',
        };
      case 'OUT OF STOCK':
        return {
          bg: '#450a0a',
          text: '#fca5a5',
          border: '#dc2626',
          dot: '#ef4444',
          label: 'OUT OF STOCK',
        };
      default:
        return {
          bg: '#1e293b',
          text: '#cbd5e1',
          border: '#475569',
          dot: '#94a3b8',
          label: status,
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        size === 'md' && styles.badgeMd,
        { backgroundColor: style.bg, borderColor: style.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: style.dot }]} />
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: style.text }]}>
        {style.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  textMd: {
    fontSize: 11,
  },
});
