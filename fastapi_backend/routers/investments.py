from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Investment
from auth import get_current_user
from schemas import InvestmentCreate, InvestmentUpdate
from typing import Optional

router = APIRouter(prefix="/api/investments", tags=["Investments"])

def _serialize_inv(inv: Investment) -> dict:
    return {
        "id": inv.id,
        "investmentName": inv.investment_name,
        "investmentType": inv.investment_type,
        "amountInvested": inv.amount_invested,
        "currentValue": inv.current_value,
        "startDate": inv.start_date,
        "status": inv.status,
        "createdAt": inv.created_at.isoformat() if inv.created_at else None,
    }

@router.get("/")
def get_investments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investments = (
        db.query(Investment)
        .filter(Investment.user_id == current_user.id, Investment.is_deleted == False)
        .order_by(desc(Investment.created_at))
        .all()
    )

    data = [_serialize_inv(i) for i in investments]
    
    total_invested = sum(i.amount_invested for i in investments if i.status == "ACTIVE")
    total_current = sum(i.current_value or i.amount_invested for i in investments if i.status == "ACTIVE")

    return {
        "investments": data,
        "summary": {
            "totalInvested": total_invested,
            "totalCurrentValue": total_current,
            "totalReturns": total_current - total_invested,
            "activeCount": len([i for i in investments if i.status == "ACTIVE"])
        }
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_investment(
    inv_in: InvestmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if inv_in.amountInvested <= 0:
        raise HTTPException(status_code=400, detail="Invalid investment amount")
    
    inv = Investment(
        user_id=current_user.id,
        investment_name=inv_in.investmentName,
        investment_type=inv_in.investmentType,
        amount_invested=inv_in.amountInvested,
        current_value=inv_in.currentValue or inv_in.amountInvested,
        start_date=inv_in.startDate,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return {"id": inv.id, "message": "Investment added successfully"}

@router.put("/{inv_id}")
def update_investment(
    inv_id: str,
    inv_in: InvestmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Investment).filter(
        Investment.id == inv_id,
        Investment.user_id == current_user.id,
        Investment.is_deleted == False,
    ).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    if inv_in.investmentName is not None:
        inv.investment_name = inv_in.investmentName
    if inv_in.investmentType is not None:
        inv.investment_type = inv_in.investmentType
    if inv_in.amountInvested is not None:
        inv.amount_invested = inv_in.amountInvested
    if inv_in.currentValue is not None:
        inv.current_value = inv_in.currentValue
    if inv_in.startDate is not None:
        inv.start_date = inv_in.startDate
    if inv_in.status is not None:
        inv.status = inv_in.status

    db.commit()
    return {"message": "Investment updated successfully"}

@router.delete("/{inv_id}")
def delete_investment(
    inv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Investment).filter(
        Investment.id == inv_id,
        Investment.user_id == current_user.id,
        Investment.is_deleted == False,
    ).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    inv.is_deleted = True
    inv.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Investment removed successfully"}
