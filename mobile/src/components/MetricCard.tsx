import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
  trend?: string;
  subtitle?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color = '#00f2fe',
  trend,
  subtitle,
}) => {
  return (
    <View style={styles.card}>
      {/* Top Ambient Glow Line */}
      <View style={[styles.glowBar, { backgroundColor: color }]} />

      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: `${color}18`, borderColor: `${color}44` },
          ]}
        >
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        {trend && (
          <View style={[styles.trendBadge, { backgroundColor: `${color}15`, borderColor: `${color}33` }]}>
            <Text style={[styles.trendText, { color }]}>{trend}</Text>
          </View>
        )}
      </View>

      <Text style={styles.valueText}>{value}</Text>
      <Text style={styles.titleText}>{title}</Text>
      {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  iconText: {
    fontSize: 20,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  valueText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  subtitleText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
});
