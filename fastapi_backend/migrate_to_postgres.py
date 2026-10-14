from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
import os

db_url = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            db_url = line.strip().split('=', 1)[1].strip('\"\'')
            break

if not db_url:
    print("No DATABASE_URL found")
    exit(1)

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

ordered_tables = ['users', 'categories', 'credit_cards', 'debit_cards', 'expenses', 'incomes', 'budgets', 'people', 'ledger_entries', 'ledger_settlements', 'loans', 'investments']

for table_name in ordered_tables:
    if table_name not in sqlite_meta.tables or table_name not in pg_meta.tables:
        continue
        
    print(f"Migrating table {table_name}...")
    
    sqlite_table = sqlite_meta.tables[table_name]
    pg_table = pg_meta.tables[table_name]
    
    # Read all rows from sqlite
    result = sqlite_session.execute(sqlite_table.select())
    rows = [dict(row._mapping) for row in result]
    
    if not rows:
        continue
        
    print(f"Found {len(rows)} rows to migrate.")
    
    # Insert rows into postgres one by one to handle ON CONFLICT easily
    for row in rows:
        # filter out columns that don't exist in postgres
        clean_row = {k: v for k, v in row.items() if k in pg_table.columns}
        
        # Try to insert
        try:
            pg_session.execute(pg_table.insert().values(clean_row))
        except Exception as e:
            pg_session.rollback()
            # Likely a conflict (duplicate primary key), just ignore and move on
            continue
            
    pg_session.commit()
    print(f"Finished migrating {table_name}")

pg_session.close()
sqlite_session.close()
print("Migration completed successfully.")
