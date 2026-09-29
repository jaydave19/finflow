import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Category
from schemas import UserRegister, UserLogin, ForgotPasswordRequest, ResetPasswordRequest
from auth import verify_password, get_password_hash, create_access_token, create_refresh_token
from config import settings
from jose import JWTError, jwt

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "icon": "Utensils", "color": "#EF4444", "monthly_budget": 0.0},
    {"name": "Groceries", "icon": "ShoppingCart", "color": "#10B981", "monthly_budget": 0.0},
    {"name": "Transportation & Fuel", "icon": "Bus", "color": "#F59E0B", "monthly_budget": 0.0},
    {"name": "Housing & Rent", "icon": "Home", "color": "#6366F1", "monthly_budget": 0.0},
    {"name": "Stock Market & IPOs", "icon": "Landmark", "color": "#4F46E5", "monthly_budget": 0.0},
    {"name": "Shopping & Lifestyle", "icon": "ShoppingBag", "color": "#EC4899", "monthly_budget": 0.0},
    {"name": "Healthcare & Medical", "icon": "HeartPulse", "color": "#14B8A6", "monthly_budget": 0.0},
    {"name": "Utilities & Bills", "icon": "Zap", "color": "#8B5CF6", "monthly_budget": 0.0},
    {"name": "Entertainment & OTT", "icon": "Tv", "color": "#06B6D4", "monthly_budget": 0.0},
    {"name": "Others", "icon": "Tag", "color": "#64748B", "monthly_budget": 0.0},
]

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(
        name=user_in.name.strip(),
        email=user_in.email.lower(),
        password_hash=get_password_hash(user_in.password),
    )
    db.add(user)
    db.flush()

    # Seed default categories
    for cat in DEFAULT_CATEGORIES:
        db.add(Category(
            user_id=user.id,
            name=cat["name"],
            icon=cat["icon"],
            color=cat["color"],
            monthly_budget=cat["monthly_budget"],
            is_default=True,
        ))

    db.commit()
    db.refresh(user)

    access_token = create_access_token({"userId": user.id, "email": user.email})
    refresh_token = create_refresh_token({"userId": user.id, "email": user.email})

    response.set_cookie(
        key="finflow_refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "currency": user.currency,
            "theme": user.theme,
            "notificationPrefs": user.notification_prefs,
        },
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }

@router.post("/login")
def login(user_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token({"userId": user.id, "email": user.email})
    refresh_token = create_refresh_token({"userId": user.id, "email": user.email})

    response.set_cookie(
        key="finflow_refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "currency": user.currency,
            "theme": user.theme,
            "notificationPrefs": user.notification_prefs,
        },
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("finflow_refresh_token")
    if not token:
        # Fallback to header or body
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Refresh token required")

    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=[settings.ALGORITHM])
        user_id = payload.get("userId")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        access_token = create_access_token({"userId": user.id, "email": user.email})
        return {"accessToken": access_token}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("finflow_refresh_token")
    return {"message": "Logged out successfully"}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user:
        return {"message": "If this email is registered, a password reset code has been created.", "demoResetCode": "123456"}

    code = str(random.randint(100000, 999999))
    user.reset_code = code
    user.reset_code_expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    return {
        "message": "Password reset code generated successfully.",
        "demoResetCode": code,
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or user.reset_code != req.code or not user.reset_code_expires_at or user.reset_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    user.password_hash = get_password_hash(req.newPassword)
    user.reset_code = None
    user.reset_code_expires_at = None
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}
