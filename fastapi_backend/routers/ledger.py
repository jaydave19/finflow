from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Person, LedgerEntry, LedgerSettlement, Expense, Income
from auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/ledger", tags=["People Ledger"])

class PersonCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    photo: Optional[str] = None
    notes: Optional[str] = None

class PersonUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    notes: Optional[str] = None

class LedgerEntryCreate(BaseModel):
    type: str
    amount: float
    date: str
    reason: Optional[str] = None
    dueDate: Optional[str] = None
    paymentMethod: Optional[str] = None
    interestRate: Optional[float] = None
    interestType: Optional[str] = None
    linkToBank: Optional[bool] = False
    personName: Optional[str] = None

class SettlementCreate(BaseModel):
    amount: float
    date: str
    paymentMethod: Optional[str] = None
    note: Optional[str] = None
    linkToBank: Optional[bool] = False
    personName: Optional[str] = None

# --- People ---

@router.get("/people")
def get_people(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    people = db.query(Person).filter(Person.user_id == current_user.id, Person.is_deleted == False).order_by(desc(Person.created_at)).all()
    
    result = []
    total_receive = 0
    total_pay = 0

    for person in people:
        entries = db.query(LedgerEntry).filter(LedgerEntry.person_id == person.id, LedgerEntry.is_deleted == False).all()
        balance = 0
        for entry in entries:
            remaining = entry.amount - entry.settled_amount
            if entry.type == 'gave':
                balance += remaining
            elif entry.type == 'took':
                balance -= remaining
        
        if balance > 0:
            total_receive += balance
        elif balance < 0:
            total_pay += abs(balance)
            
        result.append({
            "id": person.id,
            "name": person.name,
            "phone": person.phone,
            "photo": person.photo,
            "notes": person.notes,
            "balance": balance,
            "createdAt": person.created_at.isoformat() if person.created_at else None
        })

    return {
        "people": result,
        "summary": {
            "totalToReceive": total_receive,
            "totalToPay": total_pay,
            "netPosition": total_receive - total_pay
        }
    }

@router.post("/people", status_code=status.HTTP_201_CREATED)
def create_person(
    person_in: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not person_in.name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    person = Person(
        user_id=current_user.id,
        name=person_in.name,
        phone=person_in.phone,
        photo=person_in.photo,
        notes=person_in.notes
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return {"id": person.id, "message": "Person added"}

@router.put("/people/{person_id}")
def update_person(
    person_id: str,
    person_in: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id, Person.is_deleted == False).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    if person_in.name is not None:
        person.name = person_in.name
    if person_in.phone is not None:
        person.phone = person_in.phone
    if person_in.photo is not None:
        person.photo = person_in.photo
    if person_in.notes is not None:
        person.notes = person_in.notes
        
    db.commit()
    return {"message": "Person updated"}

@router.delete("/people/{person_id}")
def delete_person(
    person_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    person.is_deleted = True
    db.commit()
    return {"message": "Person deleted"}


# --- Ledger Entries ---

@router.get("/people/{person_id}/ledger")
def get_person_ledger(
    person_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id, Person.is_deleted == False).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    entries = db.query(LedgerEntry).filter(LedgerEntry.person_id == person.id, LedgerEntry.is_deleted == False).order_by(desc(LedgerEntry.date), desc(LedgerEntry.created_at)).all()

    entry_data = []
    for entry in entries:
        settlements = db.query(LedgerSettlement).filter(LedgerSettlement.entry_id == entry.id, LedgerSettlement.is_deleted == False).order_by(LedgerSettlement.date).all()
        entry_data.append({
            "id": entry.id,
            "type": entry.type,
            "amount": entry.amount,
            "date": entry.date,
            "reason": entry.reason,
            "dueDate": entry.due_date,
            "paymentMethod": entry.payment_method,
            "attachment": entry.attachment,
            "interestRate": entry.interest_rate,
            "interestType": entry.interest_type,
            "isSettled": entry.is_settled,
            "settledAmount": entry.settled_amount,
            "status": entry.status,
            "createdAt": entry.created_at.isoformat() if entry.created_at else None,
            "settlements": [{
                "id": s.id,
                "amount": s.amount,
                "date": s.date,
                "paymentMethod": s.payment_method,
                "note": s.note
            } for s in settlements]
        })

    return {
        "person": {
            "id": person.id,
            "name": person.name,
            "phone": person.phone,
            "photo": person.photo,
            "notes": person.notes
        },
        "entries": entry_data
    }

@router.post("/people/{person_id}/ledger", status_code=status.HTTP_201_CREATED)
def create_ledger_entry(
    person_id: str,
    entry_in: LedgerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id, Person.is_deleted == False).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    entry = LedgerEntry(
        user_id=current_user.id,
        person_id=person.id,
        type=entry_in.type,
        amount=entry_in.amount,
        date=entry_in.date,
        reason=entry_in.reason,
        due_date=entry_in.dueDate,
        payment_method=entry_in.paymentMethod,
        interest_rate=entry_in.interestRate,
        interest_type=entry_in.interestType
    )
    db.add(entry)
    
    if entry_in.linkToBank:
        if entry_in.type == 'gave':
            expense = Expense(
                user_id=current_user.id,
                amount=entry_in.amount,
                date=entry_in.date,
                payment_method=entry_in.paymentMethod or "Bank",
                note=f"Gave to {person.name}"
            )
            db.add(expense)
        else:
            income = Income(
                user_id=current_user.id,
                amount=entry_in.amount,
                date=entry_in.date,
                source="Ledger",
                note=f"Took from {person.name}"
            )
            db.add(income)
            
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "message": "Ledger entry added"}

@router.delete("/{entry_id}")
def delete_ledger_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id, LedgerEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.is_deleted = True
    db.commit()
    return {"message": "Entry deleted"}


# --- Settlements ---

@router.post("/{entry_id}/settle", status_code=status.HTTP_201_CREATED)
def create_settlement(
    entry_id: str,
    settle_in: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id, LedgerEntry.user_id == current_user.id, LedgerEntry.is_deleted == False).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    new_settled = entry.settled_amount + settle_in.amount
    is_settled = new_settled >= entry.amount
    new_status = "Settled" if is_settled else "Partially paid"
    
    entry.settled_amount = new_settled
    entry.is_settled = is_settled
    entry.status = new_status
    
    settlement = LedgerSettlement(
        user_id=current_user.id,
        entry_id=entry.id,
        amount=settle_in.amount,
        date=settle_in.date,
        payment_method=settle_in.paymentMethod,
        note=settle_in.note
    )
    db.add(settlement)

    if settle_in.linkToBank:
        if entry.type == 'gave':
            income = Income(
                user_id=current_user.id,
                amount=settle_in.amount,
                date=settle_in.date,
                source="Ledger Settlement",
                note=f"Repayment from {settle_in.personName or 'person'}"
            )
            db.add(income)
        else:
            expense = Expense(
                user_id=current_user.id,
                amount=settle_in.amount,
                date=settle_in.date,
                payment_method=settle_in.paymentMethod or "Bank",
                note=f"Repayment to {settle_in.personName or 'person'}"
            )
            db.add(expense)

    db.commit()
    db.refresh(settlement)
    return {"id": settlement.id, "message": "Settlement recorded"}

@router.delete("/settlement/{settlement_id}")
def delete_settlement(
    settlement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settlement = db.query(LedgerSettlement).filter(LedgerSettlement.id == settlement_id, LedgerSettlement.user_id == current_user.id, LedgerSettlement.is_deleted == False).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    entry = db.query(LedgerEntry).filter(LedgerEntry.id == settlement.entry_id).first()
    if entry:
        new_settled = max(0, entry.settled_amount - settlement.amount)
        is_settled = new_settled >= entry.amount
        new_status = "Pending" if new_settled == 0 else ("Settled" if is_settled else "Partially paid")
        
        entry.settled_amount = new_settled
        entry.is_settled = is_settled
        entry.status = new_status

    settlement.is_deleted = True
    db.commit()
    return {"message": "Settlement undone"}
