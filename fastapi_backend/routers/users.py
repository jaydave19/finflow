from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import ProfileUpdate, SettingsUpdate
from auth import get_current_user, verify_password, get_password_hash

router = APIRouter(prefix="/api/user", tags=["User Profile"])

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "avatar": current_user.avatar,
        "currency": current_user.currency,
        "theme": current_user.theme,
        "notificationPrefs": current_user.notification_prefs,
    }

@router.put("/profile")
def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if profile_in.name:
        current_user.name = profile_in.name.strip()
    if profile_in.avatar is not None:
        current_user.avatar = profile_in.avatar

    if profile_in.newPassword:
        if not profile_in.currentPassword or not verify_password(profile_in.currentPassword, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password incorrect")
        if len(profile_in.newPassword) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        current_user.password_hash = get_password_hash(profile_in.newPassword)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "avatar": current_user.avatar,
            "currency": current_user.currency,
            "theme": current_user.theme,
            "notificationPrefs": current_user.notification_prefs,
        },
    }

@router.put("/settings")
def update_settings(
    settings_in: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if settings_in.currency:
        current_user.currency = settings_in.currency
    if settings_in.theme:
        current_user.theme = settings_in.theme
    if settings_in.notificationPrefs is not None:
        current_user.notification_prefs = settings_in.notificationPrefs

    db.commit()
    return {"message": "Settings updated successfully"}

@router.delete("/")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return {"message": "User account permanently deleted"}
