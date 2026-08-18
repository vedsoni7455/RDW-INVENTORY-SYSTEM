import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import {
  createProductItem,
  updateProductItem,
  deleteProductItem,
  fetchProducts,
} from '../services/api';
import { ProductItem } from '../types';

export const ItemMasterScreen: React.FC = () => {
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const isOwnerOrManager = role === 'owner' || role === 'manager';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Add Item State
  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('Grocery');
  const [addUnit, setAddUnit] = useState('Kg');
  const [addMinStock, setAddMinStock] = useState('5');
  const [addOpeningStock, setAddOpeningStock] = useState('10');
  const [addSku, setAddSku] = useState('');

  // Edit Item State
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editTotalStock, setEditTotalStock] = useState('');

  const categories = ['ALL', 'Grocery', 'Sauce', 'Masala', 'Dairy', 'Vegetable', 'Bakery', 'Packaging', 'Non-Veg', 'Beverages'];
  const units = ['Kg', 'Bottle', 'Can', 'Ltr', 'Pack', 'Box', 'Pcs'];

  useEffect(() => {
    loadProducts();
  }, [role]);

  const loadProducts = async () => {
    const list = await fetchProducts(role);
    if (list && list.length > 0) setProducts(list);
  };

  const handleCreate = async () => {
    if (!isOwnerOrManager) {
      Alert.alert('Permission Denied', 'Only Owners and Managers can create new inventory items.');
      return;
    }

    if (!addName.trim()) {
      Alert.alert('Validation Error', 'Item Name is required.');
      return;
    }

    setLoading(true);
    const res = await createProductItem(role, {
      name: addName.trim(),
      category: addCategory.trim(),
      unit: addUnit.trim(),
      minStock: parseFloat(addMinStock) || 5,
      openingStock: parseFloat(addOpeningStock) || 0,
      sku: addSku.trim() || undefined,
    });
    setLoading(false);

    if (res.success) {
      Alert.alert('Success ✅', `Product "${addName}" created and synced to backend.`);
      setAddName('');
      setAddSku('');
      setIsAdding(false);
      loadProducts();
    } else {
      Alert.alert('Error', res.error || 'Failed to create product.');
    }
  };

  const openEditModal = (item: ProductItem) => {
    if (!isOwnerOrManager) {
      Alert.alert('Restricted Action', 'Editing item configurations requires Owner or Manager privileges.');
      return;
    }
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditUnit(item.unit);
    setEditMinStock(item.minimum_threshold.toString());
    setEditTotalStock(item.current_stock.toString());
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Item Name cannot be empty.');
      return;
    }

    setLoading(true);
    const res = await updateProductItem(role, editingItem.id, {
      name: editName.trim(),
      category: editCategory.trim(),
      unit: editUnit.trim(),
      minStock: parseFloat(editMinStock) || editingItem.minimum_threshold,
      totalStock: parseFloat(editTotalStock) || editingItem.current_stock,
    });
    setLoading(false);

    if (res.success) {
      Alert.alert('Updated ✅', `Item "${editName}" updated and synchronized with backend.`);
      setEditingItem(null);
      loadProducts();
    } else {
      Alert.alert('Update Failed', res.error || 'Could not update product.');
    }
  };

  const handleDelete = (item: ProductItem) => {
    if (!isOwnerOrManager) {
      Alert.alert('Permission Denied', 'Only Owners and Managers can delete items.');
      return;
    }

    const performDelete = async () => {
      setLoading(true);
      const res = await deleteProductItem(role, item.id);
      setLoading(false);
      if (res.success) {
        Alert.alert('Deleted', `"${item.name}" was removed from the catalog.`);
        loadProducts();
      } else {
        Alert.alert('Delete Failed', res.error || 'Could not delete item.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${item.name}" from the inventory?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete "${item.name}" from Item Master?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Item', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      selectedCategory === 'ALL' ||
      p.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <View style={styles.container}>
      <Header title="ITEM MASTER CATALOG" subtitle="Restaurant Ingredients, SKUs & Alert Rules" />

      <View style={styles.responsiveContainer}>
        {/* Role Access Banner */}
        {!isOwnerOrManager ? (
          <View style={styles.restrictedCard}>
            <Text style={styles.restrictedIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.restrictedTitle}>Staff View (Catalog Specifications)</Text>
              <Text style={styles.restrictedSub}>
                You can browse all ingredient definitions & minimum alert rules. Modifying thresholds, creating items, or removing items is restricted to Owners & Managers.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.ownerControlHeader}>
            <View style={styles.managerNotice}>
              <Text style={styles.managerNoticeText}>
                👑 Manager / Owner Access: Full Edit & Threshold Control (Auto-syncs with backend)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addToggleBtn}
              onPress={() => setIsAdding(!isAdding)}
              activeOpacity={0.8}
            >
              <Text style={styles.addToggleText}>
                {isAdding ? '✖ CLOSE FORM' : '➕ ADD NEW RESTAURANT ITEM'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Item Form */}
        {isAdding && isOwnerOrManager && (
          <ScrollView style={styles.formCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.formTitle}>✨ Define New Restaurant Item</Text>

            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Red Chilli Sauce 5 Ltr, Butter..."
              placeholderTextColor="#64748b"
              value={addName}
              onChangeText={setAddName}
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Grocery, Sauce, Masala..."
                  placeholderTextColor="#64748b"
                  value={addCategory}
                  onChangeText={setAddCategory}
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Kg, Bottle, Can..."
                  placeholderTextColor="#64748b"
                  value={addUnit}
                  onChangeText={setAddUnit}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Min Alert Threshold</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={addMinStock}
                  onChangeText={setAddMinStock}
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Opening Stock</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={addOpeningStock}
                  onChangeText={setAddOpeningStock}
                />
              </View>
            </View>

            <Text style={styles.label}>Custom SKU (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. SKU-1092"
              placeholderTextColor="#64748b"
              value={addSku}
              onChangeText={setAddSku}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitText}>
                {loading ? 'SAVING TO BACKEND...' : 'SAVE & SYNC TO DATABASE'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search items in catalog by name, category, or SKU..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
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

        {/* Items List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionHeader}>Master Catalog ({filteredProducts.length} Items)</Text>
          <TouchableOpacity onPress={loadProducts}>
            <Text style={styles.refreshLink}>REFRESH ↻</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemMain}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={styles.itemNameRow}>
                    {item.sku ? <Text style={styles.skuBadge}>{item.sku}</Text> : null}
                    <Text style={styles.itemName}>{item.name}</Text>
                  </View>
                  <Text style={styles.itemCat}>
                    {item.category} • Unit: <Text style={styles.textWhite}>{item.unit}</Text> • Stock: <Text style={styles.textCyan}>{item.current_stock} {item.unit}</Text>
                  </Text>
                </View>

                <View style={styles.itemRight}>
                  <View style={styles.minBadge}>
                    <Text style={styles.minText}>Min: {item.minimum_threshold} {item.unit}</Text>
                  </View>

                  {isOwnerOrManager && (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEditModal(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      </View>

      {/* Edit Item Modal */}
      <Modal visible={!!editingItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Edit Item Configuration</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)}>
                <Text style={styles.closeText}>✖</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={editCategory}
                  onChangeText={setEditCategory}
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={editUnit}
                  onChangeText={setEditUnit}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Min Alert Threshold</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={editMinStock}
                  onChangeText={setEditMinStock}
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Current Stock</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={editTotalStock}
                  onChangeText={setEditTotalStock}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingItem(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUpdate}
                disabled={loading}
              >
                <Text style={styles.saveText}>
                  {loading ? 'SAVING...' : 'UPDATE & SYNC BACKEND'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911' },
  responsiveContainer: { flex: 1, maxWidth: 1200, alignSelf: 'center', width: '100%', padding: 16 },
  ownerControlHeader: { marginBottom: 12 },
  managerNotice: {
    backgroundColor: '#172554',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  managerNoticeText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  addToggleBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addToggleText: { color: '#090d16', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  restrictedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  restrictedIcon: { fontSize: 24, marginRight: 12 },
  restrictedTitle: { color: '#f59e0b', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  restrictedSub: { color: '#94a3b8', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  formCard: {
    backgroundColor: '#101827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    maxHeight: 380,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  formTitle: { color: '#00f2fe', fontSize: 15, fontWeight: '900', marginBottom: 10 },
  label: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  input: {
    backgroundColor: '#060911',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1e293b',
    fontWeight: '600',
  },
  row: { flexDirection: 'row', marginHorizontal: -4 },
  col: { flex: 1, paddingHorizontal: 4 },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  submitText: { color: '#ffffff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  searchBarContainer: { marginBottom: 10 },
  searchInput: {
    backgroundColor: '#101827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1e293b',
    fontWeight: '600',
  },
  catScrollView: { flexGrow: 0, marginBottom: 12 },
  catScrollContent: { paddingRight: 16 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#101827',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  catChipActive: { backgroundColor: '#00f2fe', borderColor: '#00f2fe' },
  catChipText: { fontSize: 11, color: '#cbd5e1', fontWeight: '700' },
  catChipTextActive: { color: '#090d16', fontWeight: '900' },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  refreshLink: { color: '#00f2fe', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  listContent: { paddingBottom: 40 },
  itemCard: {
    backgroundColor: '#101827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  itemMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNameRow: { flexDirection: 'row', alignItems: 'center' },
  skuBadge: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#060911',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  itemName: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  itemCat: { color: '#64748b', fontSize: 11, marginTop: 3, fontWeight: '600' },
  textWhite: { color: '#cbd5e1' },
  textCyan: { color: '#38bdf8', fontWeight: '800' },
  itemRight: { alignItems: 'flex-end' },
  minBadge: {
    backgroundColor: '#451a03',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d97706',
    marginBottom: 6,
  },
  minText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center' },
  editBtn: {
    backgroundColor: '#172554',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginRight: 6,
  },
  editBtnText: { color: '#93c5fd', fontSize: 11, fontWeight: '800' },
  deleteBtn: {
    backgroundColor: '#450a0a',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteBtnText: { color: '#fca5a5', fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 9, 17, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 8,
  },
  modalTitle: { color: '#00f2fe', fontSize: 16, fontWeight: '900' },
  closeText: { color: '#94a3b8', fontSize: 14, fontWeight: '800' },
  modalBtnRow: { flexDirection: 'row', marginTop: 16, marginHorizontal: -4 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  saveBtn: {
    flex: 2,
    backgroundColor: '#00f2fe',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  saveText: { color: '#090d16', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
});
