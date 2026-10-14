from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
import os

db_url = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            db_url = line.strip().split('=', 1)[1].strip('\"\'')
            break

# Connect to sqlite
sqlite_engine = create_engine('sqlite:///fastapi_backend/finflow.db')
sqlite_meta = MetaData()
sqlite_meta.reflect(bind=sqlite_engine)

# Connect to postgres
pg_engine = create_engine(db_url)
pg_meta = MetaData()
pg_meta.reflect(bind=pg_engine)

sqlite_session = sessionmaker(bind=sqlite_engine)()
pg_session = sessionmaker(bind=pg_engine)()

# 1. Build User ID mapping (SQLite ID -> PG ID based on Email)
sqlite_users = sqlite_session.execute(sqlite_meta.tables['users'].select()).fetchall()
pg_users = pg_session.execute(pg_meta.tables['users'].select()).fetchall()

pg_email_to_id = {u.email: u.id for u in pg_users}
user_id_map = {}

for su in sqlite_users:
    if su.email in pg_email_to_id:
        user_id_map[su.id] = pg_email_to_id[su.email]
    else:
        # If user doesn't exist in PG, insert them
        clean_user = {k: getattr(su, k) for k in pg_meta.tables['users'].columns.keys() if hasattr(su, k)}
        try:
            pg_session.execute(pg_meta.tables['users'].insert().values(clean_user))
            pg_session.commit()
            user_id_map[su.id] = su.id
        except Exception:
            pg_session.rollback()

print("User mapping:", user_id_map)

# 2. Migrate tables
ordered_tables = ['categories', 'credit_cards', 'debit_cards', 'expenses', 'incomes', 'budgets', 'people', 'ledger_entries', 'ledger_settlements', 'loans', 'investments']

for table_name in ordered_tables:
    if table_name not in sqlite_meta.tables or table_name not in pg_meta.tables:
        continue
        
    print(f"Migrating table {table_name}...")
    sqlite_table = sqlite_meta.tables[table_name]
    pg_table = pg_meta.tables[table_name]
    
    rows = [dict(row._mapping) for row in sqlite_session.execute(sqlite_table.select())]
    if not rows: continue
        
    success_count = 0
    for row in rows:
        clean_row = {k: v for k, v in row.items() if k in pg_table.columns}
        
        # Remap user_id if it exists
        if 'user_id' in clean_row and clean_row['user_id'] in user_id_map:
            clean_row['user_id'] = user_id_map[clean_row['user_id']]
            
        try:
            pg_session.execute(pg_table.insert().values(clean_row))
            success_count += 1
        except Exception as e:
            pg_session.rollback()
            continue
            
    pg_session.commit()
    print(f"Finished migrating {table_name}: {success_count} inserted.")

pg_session.close()
sqlite_session.close()
print("Migration v2 completed successfully.")
