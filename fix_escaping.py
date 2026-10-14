import os

files_to_fix = [
    'src/pages/PersonLedgerPage.tsx',
    'server/controllers/ledgerController.ts'
]

for filepath in files_to_fix:
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content.replace('\\`', '`')
    new_content = new_content.replace('\\$', '$')
    
    with open(filepath, 'w') as f:
        f.write(new_content)
