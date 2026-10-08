from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Ledger
from auth import get_current_user
from schemas import LedgerCreate, LedgerUpdate
from typing import Optional

router = APIRouter(prefix="/api/ledger", tags=["People Ledger"])

def _serialize_ledger(ledger: Ledger) -> dict:
    return {
        "id": ledger.id,
        "personName": ledger.person_name,
        "amount": ledger.amount,
        "type": ledger.type,
        "status": ledger.status,
        "dueDate": ledger.due_date,
        "note": ledger.note,
        "createdAt": ledger.created_at.isoformat() if ledger.created_at else None,
    }

@router.get("/")
def get_ledgers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ledgers = (
        db.query(Ledger)
        .filter(Ledger.user_id == current_user.id, Ledger.is_deleted == False)
        .order_by(desc(Ledger.created_at))
        .all()
    )

    data = [_serialize_ledger(l) for l in ledgers]
    
    total_i_owe = sum(l.amount for l in ledgers if l.type == "I_OWE" and l.status != "SETTLED")
    total_they_owe = sum(l.amount for l in ledgers if l.type == "THEY_OWE" and l.status != "SETTLED")

    return {
        "ledgers": data,
        "summary": {
            "totalIOwe": total_i_owe,
            "totalTheyOwe": total_they_owe,
            "netBalance": total_they_owe - total_i_owe
        }
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_ledger(
    ledger_in: LedgerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ledger_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    if ledger_in.type not in ["I_OWE", "THEY_OWE"]:
        raise HTTPException(status_code=400, detail="Type must be I_OWE or THEY_OWE")

    ledger = Ledger(
        user_id=current_user.id,
        person_name=ledger_in.personName,
        amount=ledger_in.amount,
        type=ledger_in.type,
        due_date=ledger_in.dueDate,
        note=ledger_in.note,
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)

    return {"id": ledger.id, "message": "Ledger entry created successfully"}

@router.put("/{ledger_id}")
def update_ledger(
    ledger_id: str,
    ledger_in: LedgerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ledger = db.query(Ledger).filter(
        Ledger.id == ledger_id,
        Ledger.user_id == current_user.id,
        Ledger.is_deleted == False,
    ).first()
    
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    if ledger_in.personName is not None:
        ledger.person_name = ledger_in.personName
    if ledger_in.amount is not None:
        if ledger_in.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        ledger.amount = ledger_in.amount
    if ledger_in.type is not None:
        if ledger_in.type not in ["I_OWE", "THEY_OWE"]:
            raise HTTPException(status_code=400, detail="Type must be I_OWE or THEY_OWE")
        ledger.type = ledger_in.type
    if ledger_in.status is not None:
        ledger.status = ledger_in.status
    if ledger_in.dueDate is not None:
        ledger.due_date = ledger_in.dueDate
    if ledger_in.note is not None:
        ledger.note = ledger_in.note

    db.commit()
    return {"message": "Ledger entry updated successfully"}

@router.delete("/{ledger_id}")
def delete_ledger(
    ledger_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ledger = db.query(Ledger).filter(
        Ledger.id == ledger_id,
        Ledger.user_id == current_user.id,
        Ledger.is_deleted == False,
    ).first()
    
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    ledger.is_deleted = True
    ledger.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Ledger entry removed successfully"}
