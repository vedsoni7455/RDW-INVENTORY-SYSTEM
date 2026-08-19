import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { fetchProducts, fetchTransactions } from '../services/api';
import { jsPDF } from 'jspdf';

export const ReportsScreen: React.FC = () => {
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [reportType, setReportType] = useState<'livestock' | 'stockin' | 'stockout' | 'lowstock'>('livestock');
  const [downloading, setDownloading] = useState(false);

  const handleExportPDF = async () => {
    setDownloading(true);
    try {
      let dataList: any[] = [];
      let reportTitle = '';

      if (reportType === 'livestock' || reportType === 'lowstock') {
        const products = await fetchProducts(role);
        if (reportType === 'lowstock') {
          dataList = products.filter(p => Number(p.total_stock) <= Number(p.minimum_threshold));
          reportTitle = 'Low Stock Restock Orders Report';
        } else {
          dataList = products;
          reportTitle = 'Live Stock Summary Report';
        }
      } else {
        const res = await fetchTransactions(role, 200);
        if (res.success && res.data) {
          const typeFilter = reportType === 'stockin' ? 'IN' : 'OUT';
          dataList = res.data.filter((t: any) => t.change_type === typeFilter);
        }
        reportTitle = reportType === 'stockin' ? 'Stock In Refills Log Report' : 'Stock Out Usage Log Report';
      }

      const doc = new jsPDF();
      doc.setFont('helvetica');

      // Title Banner
      doc.setFillColor(16, 24, 39);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(0, 242, 254);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RDW RESTAURANT', 14, 18);

      doc.setTextColor(248, 250, 252);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(reportTitle.toUpperCase(), 14, 28);

      // Metadata Block
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 48);
      doc.text(`Role: ${role.toUpperCase()}`, 140, 48);
      doc.text(`Total Records: ${dataList.length}`, 140, 53);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 57, 196, 57);

      let y = 66;

      if (reportType === 'livestock' || reportType === 'lowstock') {
        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y - 6, 182, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('SKU', 18, y - 1);
        doc.text('Item Name', 45, y - 1);
        doc.text('Category', 110, y - 1);
        doc.text('Current Stock', 150, y - 1);
        doc.text('Min Limit', 180, y - 1);

        y += 8;
        doc.setFont('helvetica', 'normal');

        for (const item of dataList) {
          if (y > 275) {
            doc.addPage();
            // Header for new page
            doc.setFillColor(16, 24, 39);
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(0, 242, 254);
            doc.setFontSize(12);
            doc.text('RDW RESTAURANT INVENTORY REPORT (CONTINUED)', 14, 13);
            y = 35;

            doc.setFillColor(241, 245, 249);
            doc.rect(14, y - 6, 182, 8, 'F');
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('SKU', 18, y - 1);
            doc.text('Item Name', 45, y - 1);
            doc.text('Category', 110, y - 1);
            doc.text('Current Stock', 150, y - 1);
            doc.text('Min Limit', 180, y - 1);
            y += 8;
            doc.setFont('helvetica', 'normal');
          }

          if (Math.floor(y / 7) % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(14, y - 5, 182, 6, 'F');
          }

          doc.setTextColor(51, 65, 85);
          doc.text(item.sku || 'N/A', 18, y - 1);

          const displayName = item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name;
          doc.text(displayName, 45, y - 1);
          doc.text(item.category || 'General', 110, y - 1);
          doc.text(`${item.total_stock} ${item.unit}`, 150, y - 1);
          doc.text(`${item.minimum_threshold} ${item.unit}`, 180, y - 1);

          doc.setDrawColor(241, 245, 249);
          doc.line(14, y + 1, 196, y + 1);

          y += 7;
        }
      } else {
        // Transactions Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y - 6, 182, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Date', 18, y - 1);
        doc.text('Item Name', 45, y - 1);
        doc.text('Qty Transacted', 110, y - 1);
        doc.text('Logged By', 145, y - 1);
        doc.text('Remark / Invoice', 172, y - 1);

        y += 8;
        doc.setFont('helvetica', 'normal');

        for (const tx of dataList) {
          if (y > 275) {
            doc.addPage();
            doc.setFillColor(16, 24, 39);
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(0, 242, 254);
            doc.setFontSize(12);
            doc.text('RDW RESTAURANT INVENTORY REPORT (CONTINUED)', 14, 13);
            y = 35;

            doc.setFillColor(241, 245, 249);
            doc.rect(14, y - 6, 182, 8, 'F');
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('Date', 18, y - 1);
            doc.text('Item Name', 45, y - 1);
            doc.text('Qty Transacted', 110, y - 1);
            doc.text('Logged By', 145, y - 1);
            doc.text('Remark / Invoice', 172, y - 1);
            y += 8;
            doc.setFont('helvetica', 'normal');
          }

          if (Math.floor(y / 7) % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(14, y - 5, 182, 6, 'F');
          }

          doc.setTextColor(51, 65, 85);
          const dateStr = new Date(tx.created_at).toLocaleDateString();
          doc.text(dateStr, 18, y - 1);

          const itemName = tx.product?.name || 'Deleted SKU';
          const truncatedItem = itemName.length > 30 ? itemName.substring(0, 27) + '...' : itemName;
          doc.text(truncatedItem, 45, y - 1);

          doc.text(`${tx.quantity} ${tx.unit}`, 110, y - 1);
          doc.text(tx.created_by_name || 'System', 145, y - 1);

          const remarkText = tx.remark || 'N/A';
          const truncatedRemark = remarkText.length > 15 ? remarkText.substring(0, 12) + '...' : remarkText;
          doc.text(truncatedRemark, 172, y - 1);

          doc.setDrawColor(241, 245, 249);
          doc.line(14, y + 1, 196, y + 1);

          y += 7;
        }
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, 180, 287);
        doc.text('CONFIDENTIAL - RDW Restaurant System Auto-Generated Report', 14, 287);
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        doc.save(`rdw_inventory_${reportType}_${Date.now()}.pdf`);
        Alert.alert('PDF Downloaded ✅', `Downloaded ${reportType.toUpperCase()} PDF report successfully.`);
      } else {
        Alert.alert(
          'Export Generated ✅',
          `Report "${reportTitle}" generated successfully as PDF.`
        );
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Export Failed ❌', `Could not generate PDF: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const reportConfigs = [
    {
      id: 'livestock',
      title: 'Live Stock Summary',
      icon: '📊',
      badge: 'ALL 152 ITEMS',
      desc: 'Complete inventory audit across all SKUs showing current stock, opening stock, total received, total issued, and threshold health.',
    },
    {
      id: 'lowstock',
      title: 'Low Stock Reorders',
      icon: '🚨',
      badge: 'URGENT RESTOCK',
      desc: 'Filtered list of ingredients currently at or below minimum threshold requiring immediate vendor purchase order placement.',
    },
    {
      id: 'stockin',
      title: 'Stock In Refills Log',
      icon: '⬇️',
      badge: 'DELIVERY AUDIT',
      desc: 'Chronological audit trail of all incoming inventory check-ins, invoice tags, staff loggers, and timestamps.',
    },
    {
      id: 'stockout',
      title: 'Stock Out Usage Log',
      icon: '⬆️',
      badge: 'KITCHEN CONSUMPTION',
      desc: 'Detailed log of kitchen & bar station consumption, waste, usage remarks, and deductions.',
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="REPORTS & EXPORTS" subtitle="Audit Logs, Live Stock & Low Stock PDF Exports" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveContainer}>
          <Text style={styles.sectionTitle}>Select Report Category to Export:</Text>

          <View style={[styles.typeGrid, isDesktop && styles.typeGridDesktop]}>
            {reportConfigs.map(item => {
              const isSelected = reportType === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.typeCard, isSelected && styles.typeActive]}
                  onPress={() => setReportType(item.id as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBox, isSelected && styles.iconActive]}>
                    <Text style={styles.typeIcon}>{item.icon}</Text>
                  </View>
                  <Text style={[styles.typeText, isSelected && styles.textWhite]}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, isSelected && styles.badgeActive]}>
                    <Text style={[styles.badgeText, isSelected && styles.badgeTextActive]}>
                      {item.badge}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Details & Specs Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>Selected Report Specification:</Text>
              <Text style={styles.infoFormatBadge}>FORMAT: ADOBE PDF</Text>
            </View>
            <Text style={styles.infoDesc}>
              {reportConfigs.find(c => c.id === reportType)?.desc}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportPDF}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <Text style={styles.exportBtnText}>
              {downloading ? 'GENERATING PDF REPORT...' : `📥 DOWNLOAD ${reportType.toUpperCase()} PDF`}
            </Text>
          </TouchableOpacity>
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
  sectionTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800', marginBottom: 14 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 16 },
  typeGridDesktop: { flexWrap: 'wrap' },
  typeCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#101827',
    padding: 16,
    borderRadius: 16,
    margin: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  typeActive: { backgroundColor: '#131f33', borderColor: '#00f2fe' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  iconActive: { backgroundColor: 'rgba(0, 242, 254, 0.15)', borderColor: '#00f2fe' },
  typeIcon: { fontSize: 24 },
  typeText: { color: '#94a3b8', fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  textWhite: { color: '#f8fafc' },
  badge: {
    backgroundColor: '#090d16',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  badgeActive: { backgroundColor: 'rgba(0, 242, 254, 0.1)', borderColor: 'rgba(0, 242, 254, 0.3)' },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#64748b', letterSpacing: 0.4 },
  badgeTextActive: { color: '#00f2fe' },
  infoCard: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: { color: '#00f2fe', fontSize: 14, fontWeight: '900' },
  infoFormatBadge: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#042f2e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0d9488',
  },
  infoDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  exportBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 14, letterSpacing: 0.8 },
});
