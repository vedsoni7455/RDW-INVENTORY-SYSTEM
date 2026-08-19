import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';

async function runSeed() {
  console.log('🚀 Starting Database Seed from database/seed_data.json...');

  const seedPath = path.resolve(__dirname, '../../../database/seed_data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`❌ Error: Seed file not found at ${seedPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(seedPath, 'utf-8');
  const seedData = JSON.parse(rawData);

  const productsList = seedData.products || [];
  const stockInList = seedData.stock_in || [];
  const stockOutList = seedData.stock_out || [];

  console.log(`📦 Found ${productsList.length} products to seed.`);
  console.log(`📥 Found ${stockInList.length} Stock IN records.`);
  console.log(`📤 Found ${stockOutList.length} Stock OUT records.`);

  console.log('🧹 Clearing existing database records...');
  await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 1. Insert Products
  const nameToIdMap: Record<string, string> = {};

  for (let i = 0; i < productsList.length; i++) {
    const item = productsList[i];
    const sku = `SKU-${(i + 1).toString().padStart(4, '0')}`;
    const minStock = Number(item.min_stock) || 5.0;
    const openingStock = Number(item.opening_stock) || 0.0;

    // Insert or update product
    const { data, error } = await supabase
      .from('products')
      .upsert(
        {
          sku: sku,
          name: item.name,
          category: item.category || 'General',
          unit: item.unit || 'Kg',
          minimum_threshold: minStock,
          opening_stock: openingStock,
          total_stock: openingStock,
        },
        { onConflict: 'name' }
      )
      .select('id, name')
      .single();

    if (error) {
      console.warn(`⚠️ Warning seeding product "${item.name}":`, error.message);
      // Fetch existing ID if upsert failed due to conflict
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .eq('name', item.name)
        .single();
      if (existing) {
        nameToIdMap[existing.name] = existing.id;
      }
    } else if (data) {
      nameToIdMap[data.name] = data.id;
    }
  }

  console.log(`✅ Products processing complete. Mapped ${Object.keys(nameToIdMap).length} product IDs.`);

function parseExcelDate(excelSerial: any): string {
  try {
    const val = Number(excelSerial);
    if (isNaN(val) || val <= 0) return new Date().toISOString();
    // Excel base date is 1899-12-30 due to 1900 leap year bug
    const date = new Date((val - 25569) * 24 * 60 * 60 * 1000);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

  // 2. Insert Stock IN Transactions
  let inInserted = 0;
  for (const item of stockInList) {
    const productId = nameToIdMap[item.item];
    if (!productId) continue;

    const { error } = await supabase.from('stock_transactions').insert({
      product_id: productId,
      change_type: 'IN',
      quantity: Number(item.qty),
      unit: item.unit || 'Kg',
      remark: item.remark || 'Excel Seed Stock In',
      created_by_name: 'Excel Import',
      created_at: parseExcelDate(item.date),
    });

    if (!error) inInserted++;
  }
  console.log(`✅ Seeded ${inInserted} Stock IN transactions.`);

  // 3. Insert Stock OUT Transactions
  let outInserted = 0;
  for (const item of stockOutList) {
    const productId = nameToIdMap[item.item];
    if (!productId) continue;

    const { error } = await supabase.from('stock_transactions').insert({
      product_id: productId,
      change_type: 'OUT',
      quantity: Number(item.qty),
      unit: item.unit || 'Kg',
      remark: item.remark || 'Excel Seed Stock Out',
      created_by_name: 'Excel Import',
      created_at: parseExcelDate(item.date),
    });

    if (!error) outInserted++;
  }
  console.log(`✅ Seeded ${outInserted} Stock OUT transactions.`);

  console.log('🎉 Database Seeding Finished Successfully!');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('❌ Database Seeding Failed:', err);
  process.exit(1);
});
