import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Header } from '../components/Header';
import { MetricCard } from '../components/MetricCard';
import { useAuth } from '../context/AuthContext';
import { fetchSummaryData, fetchProducts } from '../services/api';
import { SummaryData, ProductItem } from '../types';

export const DashboardScreen: React.FC = ({ navigation }: any) => {
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const [summary, setSummary] = useState<SummaryData | null>({
    totalProducts: 152,
    lowStockCount: 4,
    totalStockInSum: 420.5,
    totalStockOutSum: 185.0,
    recentTransactions: [
      {
        id: '1',
        product_id: 'p1',
        change_type: 'IN',
        quantity: 10,
        unit: 'Kg',
        remark: 'Fresh Batch Toor Dal',
        created_by_name: 'Store Manager',
        created_at: new Date().toISOString(),
        products: { name: 'Toor Dal' },
      },
      {
        id: '2',
        product_id: 'p2',
        change_type: 'OUT',
        quantity: 2,
        unit: 'Bottle',
        remark: 'Kitchen Chinese Station Prep',
        created_by_name: 'Kitchen Staff',
        created_at: new Date().toISOString(),
        products: { name: 'Red Chilli Sauce 750 ML' },
      },
      {
        id: '3',
        product_id: 'p3',
        change_type: 'IN',
        quantity: 5,
        unit: 'Bottle',
        remark: 'Weekly Sauce Delivery Refill',
        created_by_name: 'Store Manager',
        created_at: new Date().toISOString(),
        products: { name: 'Soy Sauce 750 ML' },
      },
    ],
  });
  const [criticalItems, setCriticalItems] = useState<ProductItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    const [data, products] = await Promise.all([
      fetchSummaryData(role),
      fetchProducts(role, undefined, undefined),
    ]);
    if (data) setSummary(data);
    if (products) {
      setCriticalItems(
        products.filter(
          p => p.status === 'LOW STOCK' || p.status === 'OUT OF STOCK' || p.current_stock <= p.minimum_threshold
        ).slice(0, 3)
      );
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [role]);

  return (
    <View style={styles.container}>
      <Header title="RDW ANALYTICS" subtitle="Live Velocity, Stock Turnover & Reorder Alerts" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#00f2fe" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveContainer}>
          {/* Hero Welcome Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroGreeting}>Restaurant Inventory Velocity ⚡</Text>
                <Text style={styles.heroSub}>
                  Live synchronization across {summary?.totalProducts || 152} catalog ingredients
                </Text>
              </View>
              <View style={styles.statusPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.statusText}>SYSTEM REALTIME</Text>
              </View>
            </View>

            {/* Quick Action Shortcuts */}
            <View style={styles.quickActionRow}>
              <TouchableOpacity
                style={styles.quickBtnIn}
                onPress={() => navigation?.navigate('StockAction')}
                activeOpacity={0.8}
              >
                <Text style={styles.quickBtnIcon}>⬇️</Text>
                <View>
                  <Text style={styles.quickBtnText}>Stock In</Text>
                  <Text style={styles.quickBtnSub}>Record Refill</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBtnOut}
                onPress={() => navigation?.navigate('StockAction')}
                activeOpacity={0.8}
              >
                <Text style={styles.quickBtnIcon}>⬆️</Text>
                <View>
                  <Text style={styles.quickBtnText}>Stock Out</Text>
                  <Text style={styles.quickBtnSub}>Kitchen Usage</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBtnAdd}
                onPress={() => navigation?.navigate('LiveStock')}
                activeOpacity={0.8}
              >
                <Text style={styles.quickBtnIcon}>📦</Text>
                <View>
                  <Text style={styles.quickBtnText}>Live Feed</Text>
                  <Text style={styles.quickBtnSub}>Check Levels</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Urgent Low Stock Reorder Callout Banner (if any) */}
          {criticalItems.length > 0 && (
            <View style={styles.alertBanner}>
              <View style={styles.alertHeader}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertIcon}>🚨</Text>
                  <Text style={styles.alertTitle}>
                    CRITICAL LOW STOCK ALERT ({summary?.lowStockCount || criticalItems.length} ITEMS NEED REFILL)
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigation?.navigate('LiveStock')}>
                  <Text style={styles.alertViewAll}>VIEW ALL ➔</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.alertItemsGrid}>
                {criticalItems.map(item => (
                  <View key={item.id} style={styles.alertItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.alertItemSub}>
                        Stock: <Text style={styles.textRed}>{item.current_stock} {item.unit}</Text> (Min: {item.minimum_threshold} {item.unit})
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quickRefillBtn}
                      onPress={() => navigation?.navigate('StockAction')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.quickRefillText}>+ REFILL</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Metrics Grid */}
          <Text style={styles.sectionHeader}>Key Performance Metrics</Text>
          <View style={[styles.metricsGrid, isDesktop && styles.metricsGridDesktop]}>
            <MetricCard
              title="Total Catalog Items"
              value={summary?.totalProducts || 0}
              icon="📦"
              color="#38bdf8"
              trend="ACTIVE"
              subtitle="All ingredient SKUs"
            />
            <MetricCard
              title="Low Stock Alerts"
              value={summary?.lowStockCount || 0}
              icon="🚨"
              color="#ef4444"
              trend={summary?.lowStockCount ? 'REFILL NOW' : 'ALL GOOD'}
              subtitle="Below min threshold"
            />
            <MetricCard
              title="Total Stock In"
              value={`${summary?.totalStockInSum || 0}`}
              icon="⬇️"
              color="#10b981"
              trend="▲ REFILLS"
              subtitle="Incoming deliveries"
            />
            <MetricCard
              title="Total Stock Out"
              value={`${summary?.totalStockOutSum || 0}`}
              icon="⬆️"
              color="#f59e0b"
              trend="▼ USAGE"
              subtitle="Kitchen consumption"
            />
          </View>

          {/* Stock Velocity Trend Chart & Audit Section */}
          <View style={[styles.layoutRow, isDesktop && styles.layoutRowDesktop]}>
            {/* Chart */}
            <View style={[styles.chartCard, isDesktop && styles.chartCardDesktop]}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartTitle}>Stock Velocity (Weekly Movements)</Text>
                  <Text style={styles.chartSub}>Comparison of Units In (Refills) vs Units Out (Usage)</Text>
                </View>
              </View>

              <View style={styles.barGroup}>
                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 65, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 35, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Mon</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 95, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 55, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Tue</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 45, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 75, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Wed</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 110, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 60, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Thu</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 130, backgroundColor: '#00f2fe' }]} />
                    <View style={[styles.bar, { height: 95, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Fri</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 85, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 40, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Sat</Text>
                </View>

                <View style={styles.barItem}>
                  <View style={styles.doubleBar}>
                    <View style={[styles.bar, { height: 50, backgroundColor: '#10b981' }]} />
                    <View style={[styles.bar, { height: 30, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barLabel}>Sun</Text>
                </View>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.legendText}>Stock In (Deliveries)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.legendText}>Stock Out (Usage)</Text>
                </View>
              </View>
            </View>

            {/* Audit Log Card */}
            <View style={[styles.auditContainer, isDesktop && styles.auditContainerDesktop]}>
              <View style={styles.auditHeader}>
                <View>
                  <Text style={styles.chartTitle}>Recent Stock Audit Log</Text>
                  <Text style={styles.chartSub}>Live stream of recent transactions</Text>
                </View>
                <TouchableOpacity onPress={loadData}>
                  <Text style={styles.refreshLink}>REFRESH ↻</Text>
                </TouchableOpacity>
              </View>

              {(summary?.recentTransactions || []).map(tx => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txItemLeft}>
                      <View
                        style={[
                          styles.txIconBox,
                          tx.change_type === 'IN' ? styles.txIconBoxIn : styles.txIconBoxOut,
                        ]}
                      >
                        <Text style={styles.txIcon}>{tx.change_type === 'IN' ? '⬇️' : '⬆️'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txItemName}>{tx.products?.name || 'Item'}</Text>
                        <Text style={styles.txSub}>
                          By {tx.created_by_name || 'Staff'} • {tx.remark || 'Direct Log'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.txBadge,
                        tx.change_type === 'IN' ? styles.badgeIn : styles.badgeOut,
                      ]}
                    >
                      <Text style={styles.txBadgeText}>
                        {tx.change_type === 'IN' ? '+' : '-'}
                        {tx.quantity} {tx.unit}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  responsiveContainer: { maxWidth: 1600, alignSelf: 'center', width: '100%' },
  heroCard: {
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroGreeting: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 6,
  },
  statusText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  quickActionRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  quickBtnIn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#059669',
  },
  quickBtnOut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a03',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  quickBtnAdd: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickBtnIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  quickBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '900',
  },
  quickBtnSub: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
  },
  alertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  alertTitle: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  alertViewAll: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  alertItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  alertItemCard: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101827',
    borderRadius: 10,
    padding: 10,
    margin: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  alertItemName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  alertItemSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  textRed: {
    color: '#ef4444',
    fontWeight: '800',
  },
  quickRefillBtn: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  quickRefillText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '900',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f8fafc',
    marginVertical: 12,
    letterSpacing: 0.4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  metricsGridDesktop: {
    flexWrap: 'nowrap',
  },
  layoutRow: {
    marginTop: 8,
  },
  layoutRowDesktop: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  chartCard: {
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  chartCardDesktop: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 0,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  chartSub: { color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '600' },
  barGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barItem: { alignItems: 'center' },
  doubleBar: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: { width: 9, borderRadius: 4, marginHorizontal: 2 },
  barLabel: { color: '#64748b', fontSize: 11, marginTop: 8, fontWeight: '700' },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  auditContainer: {
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  auditContainerDesktop: {
    flex: 1,
    marginHorizontal: 8,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  refreshLink: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  txCard: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  txIconBoxIn: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  txIconBoxOut: {
    backgroundColor: '#451a03',
    borderColor: '#d97706',
  },
  txIcon: { fontSize: 14 },
  txItemName: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  txBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  badgeIn: { backgroundColor: '#064e3b', borderWidth: 1, borderColor: '#059669' },
  badgeOut: { backgroundColor: '#451a03', borderWidth: 1, borderColor: '#d97706' },
  txBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  txSub: { color: '#64748b', fontSize: 10, marginTop: 2, fontWeight: '600' },
});
