from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from database import get_db
from models import User, Category
from schemas import CategoryCreate, CategoryUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/categories", tags=["Categories"])

@router.get("/")
def get_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    categories = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.is_deleted == False
    ).order_by(desc(Category.is_default), asc(Category.name)).all()

    return {
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
                "monthlyBudget": c.monthly_budget,
                "isDefault": c.is_default,
                "createdAt": c.created_at,
            }
            for c in categories
        ]
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.name.ilike(cat_in.name.strip()),
        Category.is_deleted == False
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category with this name already exists")

    cat = Category(
        user_id=current_user.id,
        name=cat_in.name.strip(),
        icon=cat_in.icon,
        color=cat_in.color,
        monthly_budget=cat_in.monthlyBudget or 0.0,
        is_default=False,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)

    return {"id": cat.id, "message": "Category created successfully"}

@router.put("/{id}")
def update_category(
    id: str,
    cat_in: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter(Category.id == id, Category.user_id == current_user.id, Category.is_deleted == False).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if cat_in.name is not None:
        cat.name = cat_in.name.strip()
    if cat_in.icon is not None:
        cat.icon = cat_in.icon
    if cat_in.color is not None:
        cat.color = cat_in.color
    if cat_in.monthlyBudget is not None:
        cat.monthly_budget = cat_in.monthlyBudget

    db.commit()
    return {"message": "Category updated successfully"}

@router.delete("/{id}")
def delete_category(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == id, Category.user_id == current_user.id, Category.is_deleted == False).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    cat.is_deleted = True
    cat.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Category soft-deleted. Eligible for undo.", "id": id}

@router.post("/{id}/restore")
def restore_category(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    cat.is_deleted = False
    cat.deleted_at = None
    db.commit()

    return {"message": "Category restored successfully", "id": id}
