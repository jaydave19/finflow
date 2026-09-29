from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from database import get_db
from models import User, Expense, Category
from schemas import ExpenseCreate, ExpenseUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/expenses", tags=["Expenses & Stock/IPOs"])

@router.get("/")
def get_expenses(
    search: Optional[str] = None,
    categoryId: Optional[str] = None,
    paymentMethod: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    minAmount: Optional[float] = None,
    maxAmount: Optional[float] = None,
    isIpoOnly: Optional[bool] = False,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    sortBy: str = "date",
    sortOrder: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Expense).filter(Expense.user_id == current_user.id, Expense.is_deleted == False)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(or_(
            Expense.note.ilike(search_filter),
            Expense.date.ilike(search_filter),
        ))

    if categoryId:
        query = query.filter(Expense.category_id == categoryId)

    if paymentMethod:
        query = query.filter(Expense.payment_method == paymentMethod)

    if startDate:
        query = query.filter(Expense.date >= startDate)
    if endDate:
        query = query.filter(Expense.date <= endDate)

    if minAmount is not None:
        query = query.filter(Expense.amount >= minAmount)
    if maxAmount is not None:
        query = query.filter(Expense.amount <= maxAmount)

    if isIpoOnly:
        query = query.filter(Expense.ipo_details.isnot(None))

    total = query.count()

    # Sorting
    sort_column = Expense.amount if sortBy == "amount" else Expense.date
    if sortOrder.lower() == "asc":
        query = query.order_by(asc(sort_column), asc(Expense.created_at))
    else:
        query = query.order_by(desc(sort_column), desc(Expense.created_at))

    offset = (page - 1) * limit
    expenses = query.offset(offset).limit(limit).all()

    items = []
    for e in expenses:
        cat = None
        if e.category:
            cat = {
                "id": e.category.id,
                "name": e.category.name,
                "icon": e.category.icon,
                "color": e.category.color,
            }
        items.append({
            "id": e.id,
            "amount": e.amount,
            "date": e.date,
            "paymentMethod": e.payment_method,
            "note": e.note,
            "tags": e.tags or [],
            "isRecurring": e.is_recurring,
            "recurrenceType": e.recurrence_type,
            "nextDueDate": e.next_due_date,
            "ipoDetails": e.ipo_details,
            "createdAt": e.created_at,
            "category": cat,
        })

    return {
        "expenses": items,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1,
        },
    }

@router.get("/{id}")
def get_expense(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == id, Expense.user_id == current_user.id, Expense.is_deleted == False).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    cat = None
    if expense.category:
        cat = {
            "id": expense.category.id,
            "name": expense.category.name,
            "icon": expense.category.icon,
            "color": expense.category.color,
        }

    return {
        "id": expense.id,
        "amount": expense.amount,
        "date": expense.date,
        "paymentMethod": expense.payment_method,
        "note": expense.note,
        "tags": expense.tags or [],
        "isRecurring": expense.is_recurring,
        "recurrenceType": expense.recurrence_type,
        "nextDueDate": expense.next_due_date,
        "ipoDetails": expense.ipo_details,
        "createdAt": expense.created_at,
        "category": cat,
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_expense(
    exp_in: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if exp_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    expense = Expense(
        user_id=current_user.id,
        category_id=exp_in.categoryId,
        amount=exp_in.amount,
        date=exp_in.date,
        payment_method=exp_in.paymentMethod or "UPI",
        note=exp_in.note or "",
        tags=exp_in.tags or [],
        is_recurring=exp_in.isRecurring or False,
        recurrence_type=exp_in.recurrenceType,
        next_due_date=exp_in.nextDueDate,
        ipo_details=exp_in.ipoDetails,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    return {"id": expense.id, "message": "Expense created successfully"}

@router.put("/{id}")
def update_expense(
    id: str,
    exp_in: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == id, Expense.user_id == current_user.id, Expense.is_deleted == False).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if exp_in.amount is not None:
        expense.amount = exp_in.amount
    if exp_in.categoryId is not None:
        expense.category_id = exp_in.categoryId
    if exp_in.date is not None:
        expense.date = exp_in.date
    if exp_in.paymentMethod is not None:
        expense.payment_method = exp_in.paymentMethod
    if exp_in.note is not None:
        expense.note = exp_in.note
    if exp_in.tags is not None:
        expense.tags = exp_in.tags
    if exp_in.isRecurring is not None:
        expense.is_recurring = exp_in.isRecurring
    if exp_in.recurrenceType is not None:
        expense.recurrence_type = exp_in.recurrenceType
    if exp_in.nextDueDate is not None:
        expense.next_due_date = exp_in.nextDueDate
    if exp_in.ipoDetails is not None:
        expense.ipo_details = exp_in.ipoDetails

    db.commit()
    return {"message": "Expense updated successfully"}

@router.delete("/{id}")
def delete_expense(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == id, Expense.user_id == current_user.id, Expense.is_deleted == False).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Soft delete
    expense.is_deleted = True
    expense.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Expense soft-deleted. Eligible for undo.", "id": id}

@router.post("/{id}/restore")
def restore_expense(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.is_deleted = False
    expense.deleted_at = None
    db.commit()

    return {"message": "Expense restored successfully", "id": id}

@router.post("/{id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_expense(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    original = db.query(Expense).filter(Expense.id == id, Expense.user_id == current_user.id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Expense not found")

    dup = Expense(
        user_id=current_user.id,
        category_id=original.category_id,
        amount=original.amount,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        payment_method=original.payment_method,
        note=f"{original.note} (Copy)" if original.note else "Copy",
        tags=original.tags,
        is_recurring=original.is_recurring,
        recurrence_type=original.recurrence_type,
        next_due_date=original.next_due_date,
        ipo_details=original.ipo_details,
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)

    return {"id": dup.id, "message": "Expense duplicated successfully"}
