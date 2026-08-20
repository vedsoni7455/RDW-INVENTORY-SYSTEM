import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { fetchProducts, logStockTransaction } from '../services/api';
import { ProductItem } from '../types';

export const StockActionScreen: React.FC = () => {
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [actionType, setActionType] = useState<'IN' | 'OUT'>('IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = ['All', 'Grocery', 'Sauce', 'Masala', 'Dairy', 'Vegetable', 'Bakery', 'Packaging', 'Non-Veg', 'Beverages'];

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, searchQuery]);

  const loadProducts = async () => {
    const list = await fetchProducts(role, selectedCategory, searchQuery);
    if (list && list.length > 0) {
      setProducts(list);
    }
  };

  const handleQuickQtyAdd = (amount: number) => {
    const currentNum = parseFloat(quantity) || 0;
    setQuantity(Math.max(1, currentNum + amount).toString());
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('Selection Required', 'Please select a restaurant item from the list.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive quantity.');
      return;
    }

    if (actionType === 'OUT' && selectedProduct.current_stock < qtyNum) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot issue ${qtyNum} ${selectedProduct.unit}. Only ${selectedProduct.current_stock} ${selectedProduct.unit} available.`
      );
      return;
    }

    setLoading(true);
    const res = await logStockTransaction(role, {
      productId: selectedProduct.id,
      changeType: actionType,
      quantity: qtyNum,
      unit: selectedProduct.unit,
      remark: remark.trim() || undefined,
    });
    setLoading(false);

    if (res.success) {
      const updatedStock = actionType === 'IN'
        ? selectedProduct.current_stock + qtyNum
        : selectedProduct.current_stock - qtyNum;

      Alert.alert(
        'Stock Updated ✅',
        `Stock ${actionType === 'IN' ? 'In (+)' : 'Out (-)'} recorded for "${selectedProduct.name}".\nRemaining stock: ${updatedStock} ${selectedProduct.unit}`
      );
      setQuantity('1');
      setRemark('');
      setSelectedProduct(null);
      loadProducts();
    } else {
      Alert.alert('Transaction Error', res.error || 'Failed to record stock update.');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const parsedQty = parseFloat(quantity) || 0;
  const projectedStock = selectedProduct
    ? actionType === 'IN'
      ? selectedProduct.current_stock + parsedQty
      : Math.max(0, selectedProduct.current_stock - parsedQty)
    : 0;

  return (
    <View style={styles.container}>
      <Header title="RAPID STOCK ACTION" subtitle="Kitchen & Store Check-In / Check-Out" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveContainer}>
          {/* Top Bar: Action Type */}
          <View style={styles.topControlRow}>
            {/* Toggle Action Type */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleBtn, actionType === 'IN' && styles.toggleInActive]}
                onPress={() => setActionType('IN')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, actionType === 'IN' && styles.textWhite]}>
                  ⬇️ STOCK IN (REFILL)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, actionType === 'OUT' && styles.toggleOutActive]}
                onPress={() => setActionType('OUT')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, actionType === 'OUT' && styles.textWhite]}>
                  ⬆️ STOCK OUT (USAGE)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Selected Product Card or Product Picker */}
          {selectedProduct ? (
            <View style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.skuRow}>
                    {selectedProduct.sku ? (
                      <Text style={styles.skuTag}>{selectedProduct.sku}</Text>
                    ) : null}
                    <Text style={styles.selectedTitle}>{selectedProduct.name}</Text>
                  </View>
                  <Text style={styles.selectedSub}>
                    {selectedProduct.category} • Alert Threshold: {selectedProduct.minimum_threshold} {selectedProduct.unit}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => setSelectedProduct(null)}
                >
                  <Text style={styles.changeBtnText}>CHANGE ITEM ✖</Text>
                </TouchableOpacity>
              </View>

              {/* Live Projected Stock Change Pill */}
              <View style={styles.projectedBox}>
                <View style={styles.projCol}>
                  <Text style={styles.projLabel}>CURRENT STOCK</Text>
                  <Text style={styles.projVal}>
                    {selectedProduct.current_stock} {selectedProduct.unit}
                  </Text>
                </View>
                <Text style={styles.arrowIcon}>➔</Text>
                <View style={styles.projCol}>
                  <Text style={styles.projLabel}>PROJECTED STOCK</Text>
                  <Text
                    style={[
                      styles.projValNew,
                      actionType === 'IN' ? styles.textGreen : styles.textAmber,
                    ]}
                  >
                    {projectedStock} {selectedProduct.unit}
                  </Text>
                </View>
              </View>

              {/* Quick Quantity Counter */}
              <Text style={styles.inputLabel}>
                Enter Quantity ({selectedProduct.unit}) *
              </Text>
              <View style={styles.qtyRow}>
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickQtyAdd(1)}
                >
                  <Text style={styles.quickAddText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickQtyAdd(5)}
                >
                  <Text style={styles.quickAddText}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickQtyAdd(10)}
                >
                  <Text style={styles.quickAddText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickQtyAdd(25)}
                >
                  <Text style={styles.quickAddText}>+25</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Remark / Usage Note (Optional)</Text>
              <TextInput
                style={styles.remarkInput}
                placeholder="e.g. Morning Chinese Station Prep or Vendor Invoice #8401"
                placeholderTextColor="#64748b"
                value={remark}
                onChangeText={setRemark}
              />

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  actionType === 'IN' ? styles.submitIn : styles.submitOut,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.submitText}>
                  {loading
                    ? 'RECORDING TRANSACTION...'
                    : `CONFIRM ${actionType === 'IN' ? 'STOCK IN (+)' : 'STOCK OUT (-)'}`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listSection}>
              {/* Category Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScrollView}
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCategory === cat && styles.chipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Search Input */}
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Search item name or SKU (e.g. Toor Dal, Sauce, SKU-0013)..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              <Text style={styles.listTitle}>
                Select Item to {actionType === 'IN' ? 'Refill' : 'Deduct'} ({filteredProducts.length} Items)
              </Text>
              <View style={styles.listContainer}>
                {filteredProducts.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => setSelectedProduct(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemLeft}>
                      <View style={styles.skuRow}>
                        {item.sku ? <Text style={styles.skuTagSmall}>{item.sku}</Text> : null}
                        <Text style={styles.itemName}>{item.name}</Text>
                      </View>
                      <Text style={styles.itemCat}>
                        {item.category} • Min: {item.minimum_threshold} {item.unit}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemStock}>
                        {item.current_stock} <Text style={styles.unitSmall}>{item.unit}</Text>
                      </Text>
                      <Text style={styles.selectText}>SELECT ➔</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#101827',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  toggleInActive: { backgroundColor: '#10b981' },
  toggleOutActive: { backgroundColor: '#ef4444' },
  toggleText: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  textWhite: { color: '#ffffff' },
  catScrollView: { flexGrow: 0, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#101827',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  chipActive: { backgroundColor: '#00f2fe', borderColor: '#00f2fe' },
  chipText: { fontSize: 11, color: '#cbd5e1', fontWeight: '700' },
  chipTextActive: { color: '#090d16', fontWeight: '900' },
  searchInput: {
    backgroundColor: '#101827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    fontWeight: '600',
  },
  selectedCard: {
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#00f2fe',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
  },
  skuRow: { flexDirection: 'row', alignItems: 'center' },
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
  skuTagSmall: {
    color: '#00f2fe',
    fontSize: 9,
    fontWeight: '900',
    backgroundColor: '#060911',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  selectedTitle: { fontSize: 16, fontWeight: '900', color: '#00f2fe' },
  selectedSub: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  changeBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  changeBtnText: { fontSize: 10, fontWeight: '900', color: '#f59e0b', letterSpacing: 0.5 },
  projectedBox: {
    flexDirection: 'row',
    backgroundColor: '#060911',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  projCol: { alignItems: 'center' },
  projLabel: { fontSize: 9, color: '#64748b', fontWeight: '900', letterSpacing: 0.5 },
  projVal: { fontSize: 14, color: '#94a3b8', fontWeight: '800', marginTop: 2 },
  projValNew: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  arrowIcon: { color: '#00f2fe', fontSize: 18, fontWeight: '900' },
  textGreen: { color: '#10b981' },
  textAmber: { color: '#f59e0b' },
  inputLabel: { fontSize: 11, color: '#cbd5e1', marginBottom: 6, marginTop: 8, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyInput: {
    flex: 1,
    backgroundColor: '#060911',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickAddBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickAddText: { color: '#00f2fe', fontWeight: '900', fontSize: 12 },
  remarkInput: {
    backgroundColor: '#060911',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitIn: { backgroundColor: '#10b981' },
  submitOut: { backgroundColor: '#ef4444' },
  submitText: { color: '#ffffff', fontWeight: '900', fontSize: 13, letterSpacing: 0.8 },
  listSection: {},
  listTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  listContainer: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemRow: {
    minWidth: 260,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  itemLeft: { flex: 1, marginRight: 10 },
  itemName: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  itemCat: { color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '600' },
  itemRight: { alignItems: 'flex-end' },
  itemStock: { color: '#38bdf8', fontSize: 14, fontWeight: '900' },
  unitSmall: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  selectText: { fontSize: 10, color: '#00f2fe', fontWeight: '900', marginTop: 2 },
});
