import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Header } from '../components/Header';
import { StockBadge } from '../components/StockBadge';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../services/api';
import { supabase } from '../services/supabase';
import { ProductItem } from '../types';

export const LiveStockScreen: React.FC = () => {
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeDesktop = width >= 1200;
  const isDesktop = width >= 768;

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'OK'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<ProductItem | null>(null);

  const categories = ['ALL', 'Grocery', 'Sauce', 'Masala', 'Dairy', 'Vegetable', 'Bakery', 'Packaging', 'Non-Veg', 'Beverages'];

  const loadData = async () => {
    setRefreshing(true);
    const list = await fetchProducts(
      role,
      selectedCategory === 'ALL' ? undefined : selectedCategory,
      search
    );
    if (list && list.length > 0) {
      setProducts(list);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();

    try {
      const subscription = supabase
        .channel('public:products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } catch (e) {
      // Offline fallback
    }
  }, [role, search, selectedCategory]);

  const filteredList = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCat =
      selectedCategory === 'ALL' ||
      p.category.toLowerCase() === selectedCategory.toLowerCase();
    const isLow =
      p.status === 'LOW STOCK' ||
      p.status === 'OUT OF STOCK' ||
      p.current_stock <= p.minimum_threshold;
    
    if (filterType === 'LOW') return matchesSearch && matchesCat && isLow;
    if (filterType === 'OK') return matchesSearch && matchesCat && !isLow;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = products.filter(
    p => p.current_stock <= p.minimum_threshold || p.status === 'LOW STOCK' || p.status === 'OUT OF STOCK'
  ).length;

  const numCols = isLargeDesktop ? 3 : isDesktop ? 2 : 1;

  const renderProductItem = ({ item }: { item: ProductItem }) => {
    const stockRatio =
      item.minimum_threshold > 0
        ? Math.min(1, item.current_stock / (item.minimum_threshold * 2))
        : 1;
    const isLow = item.current_stock <= item.minimum_threshold;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isDesktop && styles.cardDesktop,
          isLargeDesktop && styles.cardLargeDesktop,
          isLow && styles.cardLow,
        ]}
        onPress={() => setSelectedDetailItem(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardMain}>
          <View style={styles.infoLeft}>
            <View style={styles.nameRow}>
              {item.sku ? <Text style={styles.skuTag}>{item.sku}</Text> : null}
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.productSub}>
              {item.category} • Min: {item.minimum_threshold} {item.unit}
            </Text>

            {/* Stock Meter Progress Bar */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(6, Math.round(stockRatio * 100))}%`,
                    backgroundColor: isLow ? '#ef4444' : stockRatio < 0.6 ? '#f59e0b' : '#10b981',
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.infoRight}>
            <Text style={[styles.stockValue, isLow && styles.textRed]}>
              {item.current_stock} <Text style={styles.unitText}>{item.unit}</Text>
            </Text>
            <View style={styles.badgeWrapper}>
              <StockBadge status={item.status || (isLow ? 'LOW STOCK' : 'SUFFICIENT')} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="LIVE STOCK INVENTORY" subtitle="Real-time WebSockets Inventory Feed" />

      <View style={styles.responsiveContainer}>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search ingredient name or SKU (e.g. Toor Dal, Sauce, SKU-0013)..."
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
            />
            {search !== '' && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearIcon}>✖</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScrollView}
          contentContainerStyle={styles.catScrollContent}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.catChipText,
                  selectedCategory === cat && styles.catChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, filterType === 'ALL' && styles.tabActive]}
            onPress={() => setFilterType('ALL')}
          >
            <Text style={[styles.tabText, filterType === 'ALL' && styles.textWhite]}>
              ALL ITEMS ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, filterType === 'LOW' && styles.tabLowActive]}
            onPress={() => setFilterType('LOW')}
          >
            <Text style={[styles.tabText, filterType === 'LOW' && styles.textWhite]}>
              🚨 LOW STOCK ({lowStockCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, filterType === 'OK' && styles.tabOkActive]}
            onPress={() => setFilterType('OK')}
          >
            <Text style={[styles.tabText, filterType === 'OK' && styles.textWhite]}>
              ✅ SUFFICIENT ({products.length - lowStockCount})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredList}
          keyExtractor={item => item.id}
          renderItem={renderProductItem}
          numColumns={numCols}
          key={`cols-${numCols}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#00f2fe" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No Items Found</Text>
              <Text style={styles.emptyText}>
                Try searching for another ingredient or change the category filter.
              </Text>
            </View>
          }
        />
      </View>

      {/* Item Detail Modal */}
      <Modal
        visible={!!selectedDetailItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDetailItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedDetailItem && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <View style={styles.nameRow}>
                      {selectedDetailItem.sku ? (
                        <Text style={styles.skuTag}>{selectedDetailItem.sku}</Text>
                      ) : null}
                      <Text style={styles.modalTitle}>{selectedDetailItem.name}</Text>
                    </View>
                    <Text style={styles.modalSub}>{selectedDetailItem.category} Category</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedDetailItem(null)}>
                    <Text style={styles.closeText}>✖</Text>
                  </TouchableOpacity>
                </View>

                {/* Stock Stats Grid */}
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatLabel}>CURRENT STOCK</Text>
                    <Text
                      style={[
                        styles.modalStatVal,
                        selectedDetailItem.current_stock <= selectedDetailItem.minimum_threshold
                          ? styles.textRed
                          : styles.textCyan,
                      ]}
                    >
                      {selectedDetailItem.current_stock} {selectedDetailItem.unit}
                    </Text>
                  </View>

                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatLabel}>MIN ALERT</Text>
                    <Text style={styles.modalStatVal}>
                      {selectedDetailItem.minimum_threshold} {selectedDetailItem.unit}
                    </Text>
                  </View>

                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatLabel}>OPENING STOCK</Text>
                    <Text style={styles.modalStatVal}>
                      {selectedDetailItem.opening_stock || 0} {selectedDetailItem.unit}
                    </Text>
                  </View>

                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatLabel}>STOCK HEALTH</Text>
                    <View style={{ marginTop: 4 }}>
                      <StockBadge
                        status={
                          selectedDetailItem.current_stock <= selectedDetailItem.minimum_threshold
                            ? 'LOW STOCK'
                            : 'SUFFICIENT'
                        }
                        size="md"
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedDetailItem(null)}
                >
                  <Text style={styles.modalCloseText}>CLOSE DETAILS</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911' },
  responsiveContainer: { maxWidth: 1600, alignSelf: 'center', width: '100%' },
  searchBarContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101827',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  clearIcon: { fontSize: 12, color: '#94a3b8', padding: 4 },
  catScrollView: { flexGrow: 0, marginVertical: 8 },
  catScrollContent: { paddingHorizontal: 16 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#101827',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  catChipActive: { backgroundColor: '#00f2fe', borderColor: '#00f2fe' },
  catChipText: { fontSize: 11, color: '#cbd5e1', fontWeight: '700' },
  catChipTextActive: { color: '#090d16', fontWeight: '900' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#101827',
    marginHorizontal: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
  tabLowActive: { backgroundColor: '#ef4444', borderColor: '#f87171' },
  tabOkActive: { backgroundColor: '#064e3b', borderColor: '#10b981' },
  tabText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  textWhite: { color: '#ffffff' },
  listContent: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDesktop: {
    flex: 1,
    maxWidth: '49%',
  },
  cardLargeDesktop: {
    maxWidth: '32.5%',
  },
  cardLow: { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: '#1a1016' },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  skuTag: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#060911',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  productName: { color: '#f8fafc', fontSize: 14, fontWeight: '800', flex: 1 },
  productSub: { color: '#94a3b8', fontSize: 11, marginTop: 2, fontWeight: '600' },
  progressBg: {
    height: 5,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  infoRight: { alignItems: 'flex-end' },
  stockValue: { fontSize: 18, fontWeight: '900', color: '#38bdf8' },
  textRed: { color: '#ef4444' },
  textCyan: { color: '#00f2fe' },
  unitText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  badgeWrapper: { marginTop: 4 },
  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 9, 17, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
  },
  modalTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '900' },
  modalSub: { color: '#94a3b8', fontSize: 12, marginTop: 2, fontWeight: '600' },
  closeText: { color: '#94a3b8', fontSize: 14, fontWeight: '800' },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 18,
  },
  modalStatBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    marginTop: 4,
  },
  modalCloseBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#cbd5e1',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
