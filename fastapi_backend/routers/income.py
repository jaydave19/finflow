from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Income
from schemas import IncomeCreate, IncomeUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/income", tags=["Income"])

@router.get("/")
def get_incomes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    incomes = db.query(Income).filter(
        Income.user_id == current_user.id,
        Income.is_deleted == False
    ).order_by(desc(Income.date), desc(Income.created_at)).all()

    return {
        "incomes": [
            {
                "id": i.id,
                "amount": i.amount,
                "source": i.source,
                "date": i.date,
                "note": i.note,
                "createdAt": i.created_at,
            }
            for i in incomes
        ]
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_income(
    inc_in: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if inc_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    income = Income(
        user_id=current_user.id,
        amount=inc_in.amount,
        source=inc_in.source,
        date=inc_in.date,
        note=inc_in.note or "",
    )
    db.add(income)
    db.commit()
    db.refresh(income)

    return {"id": income.id, "message": "Income added successfully"}

@router.put("/{id}")
def update_income(
    id: str,
    inc_in: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = db.query(Income).filter(Income.id == id, Income.user_id == current_user.id, Income.is_deleted == False).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    if inc_in.amount is not None:
        income.amount = inc_in.amount
    if inc_in.source is not None:
        income.source = inc_in.source
    if inc_in.date is not None:
        income.date = inc_in.date
    if inc_in.note is not None:
        income.note = inc_in.note

    db.commit()
    return {"message": "Income updated successfully"}

@router.delete("/{id}")
def delete_income(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    income = db.query(Income).filter(Income.id == id, Income.user_id == current_user.id, Income.is_deleted == False).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    income.is_deleted = True
    income.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Income deleted (soft-delete). Eligible for undo.", "id": id}

@router.post("/{id}/restore")
def restore_income(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    income = db.query(Income).filter(Income.id == id, Income.user_id == current_user.id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    income.is_deleted = False
    income.deleted_at = None
    db.commit()

    return {"message": "Income restored successfully", "id": id}
