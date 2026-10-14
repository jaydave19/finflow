import pandas as pd
from io import BytesIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Expense, Income, Category, StatementUpload, TransactionRule
from auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/statements", tags=["Bank Statements"])

class ParsedRow(BaseModel):
    id: str
    date: str
    description: str
    amount: float
    type: str # 'debit' or 'credit'
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    isDuplicate: bool = False
    suggestedLink: Optional[str] = None # 'Loan', 'Investment', 'Person'

class SaveStatementRequest(BaseModel):
    uploadId: str
    transactions: List[ParsedRow]

def _get_uncategorized_category(db: Session, user_id: str):
    cat = db.query(Category).filter(
        Category.user_id == user_id,
        Category.name.ilike("%other%"),
        Category.is_deleted == False
    ).first()
    return cat.id if cat else None

def _apply_rules(description: str, rules: list, categories: dict, default_cat_id: str):
    desc_lower = description.lower()
    for r in rules:
        if r.keyword.lower() in desc_lower:
            return r.category_id, categories.get(r.category_id, "Categorized by Rule")
    
    # Generic keywords
    if "zomato" in desc_lower or "swiggy" in desc_lower: return default_cat_id, "Food (Auto)"
    if "amazon" in desc_lower or "flipkart" in desc_lower: return default_cat_id, "Shopping (Auto)"
    if "emi" in desc_lower or "loan" in desc_lower: return default_cat_id, "EMI/Loan (Auto)"
    
    return default_cat_id, "Uncategorized"

@router.post("/parse")
async def parse_statement(
    bankName: str = Form(...),
    period: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # This is a generic parser for CSV. In a real world app, this would use pdfplumber for PDFs
    # and bank-specific column mapping logic.
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported in this demo.")

    contents = await file.read()
    try:
        df = pd.read_csv(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    df.columns = [str(c).strip().lower() for c in df.columns]
    
    if not any(col in df.columns for col in ['amount', 'debit', 'credit']):
        raise HTTPException(status_code=400, detail="CSV must contain Amount, Debit, or Credit columns.")

    rules = db.query(TransactionRule).filter(TransactionRule.user_id == current_user.id).all()
    user_cats = db.query(Category).filter(Category.user_id == current_user.id).all()
    cat_map = {c.id: c.name for c in user_cats}
    default_cat_id = _get_uncategorized_category(db, current_user.id)

    # Detect duplicates across last 60 days
    recent_expenses = db.query(Expense).filter(Expense.user_id == current_user.id).all()
    expense_signatures = set(f"{e.date}_{e.amount}_{e.note.split(' [')[0]}" for e in recent_expenses)

    parsed_rows = []
    for index, row in df.iterrows():
        try:
            # Handle different amount formats
            amount = 0.0
            type_str = 'debit'
            if 'amount' in df.columns:
                amount = float(row.get('amount', 0))
                if amount < 0:
                    amount = abs(amount)
                    type_str = 'debit'
                else:
                    type_str = 'credit'
            elif 'debit' in df.columns and pd.notna(row.get('debit')):
                amount = float(row.get('debit', 0))
                type_str = 'debit'
            elif 'credit' in df.columns and pd.notna(row.get('credit')):
                amount = float(row.get('credit', 0))
                type_str = 'credit'
                
            if amount <= 0: continue

            raw_date = row.get('date', datetime.utcnow().strftime("%Y-%m-%d"))
            desc = str(row.get('description', 'Bank Statement Txn'))
            
            try:
                date_str = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
            except:
                date_str = datetime.utcnow().strftime("%Y-%m-%d")

            cat_id, cat_name = _apply_rules(desc, rules, cat_map, default_cat_id)
            
            sig = f"{date_str}_{amount}_{desc}"
            is_dup = sig in expense_signatures

            # Detection heuristics
            suggested = None
            if "emi" in desc.lower(): suggested = "Loan"
            elif "mf" in desc.lower() or "sip" in desc.lower(): suggested = "Investment"
            elif "upi" in desc.lower(): suggested = "Person"

            parsed_rows.append({
                "id": f"temp_{index}",
                "date": date_str,
                "description": desc,
                "amount": amount,
                "type": type_str,
                "categoryId": cat_id,
                "categoryName": cat_name,
                "isDuplicate": is_dup,
                "suggestedLink": suggested
            })
        except:
            continue

    upload = StatementUpload(
        user_id=current_user.id,
        bank_name=bankName,
        period_type=period,
        file_name=file.filename,
        parsed_count=len(parsed_rows)
    )
    db.add(upload)
    db.commit()

    return {
        "uploadId": upload.id,
        "transactions": parsed_rows
    }

@router.post("/save")
def save_statement(
    req: SaveStatementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    upload = db.query(StatementUpload).filter(StatementUpload.id == req.uploadId).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload session not found")

    saved = 0
    for tx in req.transactions:
        if tx.type == 'debit':
            expense = Expense(
                user_id=current_user.id,
                category_id=tx.categoryId,
                amount=tx.amount,
                date=tx.date,
                payment_method=upload.bank_name,
                note=f"{tx.description} [{upload.period_type}]",
                tags=["imported", "bank_statement"]
            )
            db.add(expense)
        else:
            income = Income(
                user_id=current_user.id,
                amount=tx.amount,
                source=upload.bank_name,
                date=tx.date,
                note=f"{tx.description} [{upload.period_type}]"
            )
            db.add(income)
            
        # If user changed category, save as rule (mock logic: we assume if they mapped it, it's a rule)
        # We would check if keyword rule exists, but for simplicity, we skip complex rule building here.
        saved += 1
        
    upload.saved_count = saved
    db.commit()
    
    return {"message": f"Successfully saved {saved} transactions."}

@router.get("/history")
def get_upload_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    uploads = db.query(StatementUpload).filter(StatementUpload.user_id == current_user.id, StatementUpload.is_deleted == False).order_by(desc(StatementUpload.created_at)).all()
    return [{"id": u.id, "bankName": u.bank_name, "period": u.period_type, "fileName": u.file_name, "savedCount": u.saved_count, "date": u.created_at.isoformat()} for u in uploads]

@router.delete("/history/{upload_id}")
def delete_upload_and_transactions(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    upload = db.query(StatementUpload).filter(StatementUpload.id == upload_id, StatementUpload.user_id == current_user.id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    upload.is_deleted = True
    
    # Cascade delete expenses imported by this
    search_tag = f"[{upload.period_type}]"
    db.query(Expense).filter(Expense.user_id == current_user.id, Expense.payment_method == upload.bank_name, Expense.note.like(f"%{search_tag}%")).delete(synchronize_session=False)
    
    db.commit()
    return {"message": "Upload history and associated transactions deleted."}
