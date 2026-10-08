from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, DebitCard, Expense
from auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/debit-cards", tags=["Debit Cards"])

# ─── Schemas ────────────────────────────────────────────────────────────────

class DebitCardCreate(BaseModel):
    cardName: str
    bankName: str
    last4: str
    cardNetwork: Optional[str] = "Visa"
    accountBalance: Optional[float] = 0.0   # Real bank account balance
    color: Optional[str] = "#065F46"

class DebitCardUpdate(BaseModel):
    cardName: Optional[str] = None
    bankName: Optional[str] = None
    last4: Optional[str] = None
    cardNetwork: Optional[str] = None
    accountBalance: Optional[float] = None
    color: Optional[str] = None

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _card_spent(db: Session, card_id: str) -> float:
    """Sum of non-deleted expenses linked to this debit card."""
    result = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.debit_card_id == card_id,
        Expense.is_deleted == False,
    ).scalar()
    return float(result or 0.0)

def _serialize_card(card: DebitCard, spent: float) -> dict:
    balance = card.account_balance or 0.0
    remaining = max(balance - spent, 0.0)
    return {
        "id": card.id,
        "cardName": card.card_name,
        "bankName": card.bank_name,
        "last4": card.last4,
        "cardNetwork": card.card_network,
        "accountBalance": round(balance, 2),
        "currentSpent": round(spent, 2),
        "remainingBalance": round(remaining, 2),
        "color": card.color,
        "createdAt": card.created_at.isoformat() if card.created_at else None,
    }

# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cards = (
        db.query(DebitCard)
        .filter(DebitCard.user_id == current_user.id, DebitCard.is_deleted == False)
        .order_by(DebitCard.created_at.asc())
        .all()
    )

    card_data = []
    total_balance = 0.0
    total_spent = 0.0

    for card in cards:
        spent = _card_spent(db, card.id)
        total_spent += spent
        total_balance += (card.account_balance or 0.0)
        tx_count = db.query(Expense).filter(
            Expense.debit_card_id == card.id,
            Expense.is_deleted == False,
        ).count()
        serialized = _serialize_card(card, spent)
        serialized["txCount"] = tx_count
        card_data.append(serialized)

    return {
        "cards": card_data,
        "summary": {
            "totalBalance": round(total_balance, 2),
            "totalSpent": round(total_spent, 2),
            "totalRemaining": round(max(total_balance - total_spent, 0.0), 2),
            "cardsCount": len(card_data),
        },
    }


@router.get("/{card_id}")
def get_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(DebitCard).filter(
        DebitCard.id == card_id,
        DebitCard.user_id == current_user.id,
        DebitCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Debit card not found")

    expenses = (
        db.query(Expense)
        .filter(Expense.debit_card_id == card_id, Expense.is_deleted == False)
        .order_by(Expense.date.desc(), Expense.created_at.desc())
        .limit(50)
        .all()
    )

    transactions = []
    for e in expenses:
        transactions.append({
            "id": e.id,
            "date": e.date,
            "amount": e.amount,
            "note": e.note,
            "paymentMethod": e.payment_method,
            "categoryName": e.category.name if e.category else "Uncategorized",
            "categoryColor": e.category.color if e.category else "#6366F1",
            "tags": e.tags or [],
        })

    spent = _card_spent(db, card.id)
    return {
        **_serialize_card(card, spent),
        "transactions": transactions,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_card(
    card_in: DebitCardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(card_in.last4) != 4 or not card_in.last4.isdigit():
        raise HTTPException(status_code=400, detail="last4 must be exactly 4 digits")

    card = DebitCard(
        user_id=current_user.id,
        card_name=card_in.cardName,
        bank_name=card_in.bankName,
        last4=card_in.last4,
        card_network=card_in.cardNetwork or "Visa",
        account_balance=card_in.accountBalance or 0.0,
        color=card_in.color or "#065F46",
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    return {"id": card.id, "message": "Debit card added successfully"}


@router.put("/{card_id}")
def update_card(
    card_id: str,
    card_in: DebitCardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(DebitCard).filter(
        DebitCard.id == card_id,
        DebitCard.user_id == current_user.id,
        DebitCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Debit card not found")

    if card_in.cardName is not None:
        card.card_name = card_in.cardName
    if card_in.bankName is not None:
        card.bank_name = card_in.bankName
    if card_in.last4 is not None:
        card.last4 = card_in.last4
    if card_in.cardNetwork is not None:
        card.card_network = card_in.cardNetwork
    if card_in.accountBalance is not None:
        card.account_balance = card_in.accountBalance
    if card_in.color is not None:
        card.color = card_in.color

    db.commit()
    return {"message": "Debit card updated successfully"}


@router.delete("/{card_id}")
def delete_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(DebitCard).filter(
        DebitCard.id == card_id,
        DebitCard.user_id == current_user.id,
        DebitCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Debit card not found")

    card.is_deleted = True
    card.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Debit card removed successfully", "id": card_id}
