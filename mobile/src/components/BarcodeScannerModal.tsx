import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { ProductItem } from '../types';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanItem: (product: ProductItem) => void;
  products: ProductItem[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanItem,
  products,
}) => {
  const [manualSku, setManualSku] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const sampleQuickBarcodes = products.slice(0, 6);

  const handleLookup = (skuOrName: string) => {
    const term = skuOrName.trim().toLowerCase();
    if (!term) return;

    const matched = products.find(
      p => (p.sku && p.sku.toLowerCase() === term) || p.name.toLowerCase().includes(term) || p.id.toLowerCase() === term
    );

    if (matched) {
      setErrorMsg('');
      setManualSku('');
      onScanItem(matched);
      onClose();
    } else {
      setErrorMsg(`No product found matching "${skuOrName}". Try another SKU.`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.headerIcon}>📷</Text>
              <Text style={styles.headerTitle}>QR & Barcode Scanner</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✖</Text>
            </TouchableOpacity>
          </View>

          {/* Scanner Simulation Viewport */}
          <View style={styles.viewportContainer}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              <View style={styles.laserLine} />
              <Text style={styles.scanInstruction}>
                Align Barcode / QR Code within the frame
              </Text>
            </View>
          </View>

          {/* Manual Barcode / SKU Input */}
          <Text style={styles.inputLabel}>Or Enter / Paste Barcode SKU:</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. SKU-0013, SKU-0001, Toor Dal"
              placeholderTextColor="#64748b"
              value={manualSku}
              onChangeText={text => {
                setManualSku(text);
                setErrorMsg('');
              }}
              onSubmitEditing={() => handleLookup(manualSku)}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.lookupBtn}
              onPress={() => handleLookup(manualSku)}
              activeOpacity={0.8}
            >
              <Text style={styles.lookupText}>SCAN ⚡</Text>
            </TouchableOpacity>
          </View>

          {errorMsg !== '' && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}

          {/* Quick Barcode Simulation Buttons */}
          <Text style={styles.quickLabel}>Simulate Barcode Tap:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
            {sampleQuickBarcodes.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.quickPill}
                onPress={() => handleLookup(p.sku || p.name)}
              >
                <Text style={styles.quickSku}>{p.sku || 'SKU'}</Text>
                <Text style={styles.quickName} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#131c2e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e2e4a',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2e4a',
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e2e4a',
  },
  closeText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '800',
  },
  viewportContainer: {
    height: 180,
    backgroundColor: '#090d16',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e2e4a',
  },
  scannerFrame: {
    width: 200,
    height: 120,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#00f2fe',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laserLine: {
    position: 'absolute',
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scanInstruction: {
    position: 'absolute',
    bottom: -24,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  inputLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#090d16',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1e2e4a',
    fontWeight: '600',
  },
  lookupBtn: {
    backgroundColor: '#00f2fe',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  lookupText: {
    color: '#090d16',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  quickLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  quickRow: {
    flexGrow: 0,
  },
  quickPill: {
    backgroundColor: '#090d16',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e2e4a',
    maxWidth: 130,
  },
  quickSku: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '900',
  },
  quickName: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
});
