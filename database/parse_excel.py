import glob
import zipfile
import json
import uuid
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

products_map = {}
stock_in_list = []
stock_out_list = []

for filename in sorted(glob.glob('*.xlsx')):
    with zipfile.ZipFile(filename) as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall(f'.//{NS}si'):
                t_els = si.findall(f'.//{NS}t')
                shared_strings.append(''.join([t.text or '' for t in t_els]))
        
        tree = ET.fromstring(z.read('xl/workbook.xml'))
        sheet_map = {}
        for s in tree.findall(f'.//{NS}sheet'):
            sheet_map[s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] = s.attrib.get('name')
        
        rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel_target = {}
        for r in rels_tree:
            rel_target[r.attrib['Id']] = r.attrib['Target']
            
        for r_id, s_name in sheet_map.items():
            target_file = 'xl/' + rel_target[r_id]
            if target_file not in z.namelist(): 
                continue
            stree = ET.fromstring(z.read(target_file))
            rows = stree.findall(f'.//{NS}row')
            
            for row in rows:
                row_cells = {}
                for c in row.findall(f'.//{NS}c'):
                    ref = c.attrib.get('r')
                    col_letter = ''.join([ch for ch in ref if ch.isalpha()])
                    c_type = c.attrib.get('t')
                    v_el = c.find(f'{NS}v')
                    val = v_el.text if v_el is not None else ''
                    if c_type == 's' and val.isdigit():
                        idx = int(val)
                        val = shared_strings[idx] if idx < len(shared_strings) else val
                    row_cells[col_letter] = val.strip()
                
                r_idx = int(row.attrib.get('r'))
                if r_idx == 1:
                    continue
                
                if s_name == 'ITEM MASTER':
                    name = row_cells.get('A')
                    if name and name != 'ITEM NAME':
                        if name not in products_map:
                            products_map[name] = {
                                'category': row_cells.get('B') or 'General',
                                'unit': row_cells.get('C') or 'Kg',
                                'min_stock': float(row_cells.get('D') or 5.0),
                                'opening_stock': float(row_cells.get('E') or 0.0)
                            }
                elif s_name == 'STOCK IN':
                    item = row_cells.get('B')
                    qty = row_cells.get('C')
                    if item and qty and item != 'ITEM NAME':
                        try:
                            stock_in_list.append({
                                'date': row_cells.get('A'),
                                'item': item,
                                'qty': float(qty),
                                'unit': row_cells.get('D') or 'Kg',
                                'remark': row_cells.get('E') or 'Excel Migration Stock In'
                            })
                        except: pass
                elif s_name == 'STOCK OUT':
                    item = row_cells.get('B')
                    qty = row_cells.get('C')
                    if item and qty and item != 'ITEM NAME':
                        try:
                            stock_out_list.append({
                                'date': row_cells.get('A'),
                                'item': item,
                                'qty': float(qty),
                                'unit': row_cells.get('D') or 'Kg',
                                'remark': row_cells.get('E') or 'Excel Migration Stock Out'
                            })
                        except: pass

print(f'Extracted {len(products_map)} unique products, {len(stock_in_list)} stock in records, {len(stock_out_list)} stock out records.')

sql_lines = ['-- SEED DATA FROM EXCEL FILES\n']

# Seed Users
sql_lines.append("""INSERT INTO users (id, email, name, role, phone_number) VALUES 
('11111111-1111-1111-1111-111111111111', 'owner@rdwrestaurant.com', 'Restaurant Owner', 'owner', '+919876543210'),
('22222222-2222-2222-2222-222222222222', 'manager@rdwrestaurant.com', 'Store Manager', 'manager', '+919876543211'),
('33333333-3333-3333-3333-333333333333', 'kitchen@rdwrestaurant.com', 'Kitchen Staff', 'staff', '+919876543212')
ON CONFLICT (email) DO NOTHING;\n""")

p_ids = {}
for idx, (name, details) in enumerate(products_map.items(), 1):
    pid = str(uuid.uuid4())
    p_ids[name] = pid
    cat = details['category'].replace("'", "''")
    unit = details['unit'].replace("'", "''")
    pname = name.replace("'", "''")
    sku = f"SKU-{idx:04d}"
    min_s = details['min_stock']
    op_s = details['opening_stock']
    sql_lines.append(f"INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('{pid}', '{sku}', '{pname}', '{cat}', '{unit}', {op_s}, {op_s}, {min_s}) ON CONFLICT (name) DO NOTHING;")

# Seed Stock Transactions
for item in stock_in_list:
    pname = item['item']
    if pname in p_ids:
        pid = p_ids[pname]
        qty = item['qty']
        unit = item['unit'].replace("'", "''")
        remark = item['remark'].replace("'", "''")
        sql_lines.append(f"INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('{pid}', 'IN', {qty}, '{unit}', '{remark}', 'System Migration');")

for item in stock_out_list:
    pname = item['item']
    if pname in p_ids:
        pid = p_ids[pname]
        qty = item['qty']
        unit = item['unit'].replace("'", "''")
        remark = item['remark'].replace("'", "''")
        sql_lines.append(f"INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('{pid}', 'OUT', {qty}, '{unit}', '{remark}', 'System Migration');")

with open('database/seed_data.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

# Also output seed_data.json for Node.js backend loader
seed_json = {
    'products': [{'name': k, **v} for k, v in products_map.items()],
    'stock_in': stock_in_list,
    'stock_out': stock_out_list
}
with open('database/seed_data.json', 'w', encoding='utf-8') as f:
    json.dump(seed_json, f, indent=2)

print('Wrote database/seed_data.sql and database/seed_data.json successfully!')
