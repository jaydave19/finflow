import pandas as pd
from io import BytesIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from models import User, Expense, Category
from auth import get_current_user

router = APIRouter(prefix="/api/statements", tags=["Bank Statements"])

def _get_uncategorized_category(db: Session, user_id: str):
    cat = db.query(Category).filter(
        Category.user_id == user_id,
        Category.name.ilike("%other%"),
        Category.is_deleted == False
    ).first()
    return cat.id if cat else None

@router.post("/upload")
async def upload_statement(
    bankName: str = Form(...),
    period: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported currently.")

    contents = await file.read()
    
    try:
        df = pd.read_csv(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # We expect columns like Date, Description, Amount, Type
    # Try to standardize column names
    df.columns = [str(c).strip().lower() for c in df.columns]
    
    required_cols = ['amount']
    if not any(col in df.columns for col in required_cols):
        raise HTTPException(status_code=400, detail="CSV must contain an 'Amount' column.")

    imported_count = 0
    total_amount = 0.0
    cat_id = _get_uncategorized_category(db, current_user.id)
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    for index, row in df.iterrows():
        try:
            # Extract basic data
            amount = float(row.get('amount', 0))
            if amount <= 0:
                continue # Skip zero or negative (if they represent income)

            raw_date = row.get('date', today_str)
            note = str(row.get('description', 'Bank Statement Import'))
            
            # Simple Date Parsing (fallback to today if fails)
            try:
                date_str = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
            except:
                date_str = today_str

            expense = Expense(
                user_id=current_user.id,
                category_id=cat_id,
                amount=amount,
                date=date_str,
                payment_method=bankName,
                note=f"{note} [{period}]",
                tags=["imported", "bank_statement"],
            )
            db.add(expense)
            imported_count += 1
            total_amount += amount
        except Exception as e:
            # Skip rows that fail parsing
            continue

    if imported_count > 0:
        db.commit()

    return {
        "message": f"Successfully imported {imported_count} expenses.",
        "importedCount": imported_count,
        "totalAmount": round(total_amount, 2)
    }
