from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Notification
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("/")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(desc(Notification.created_at)).limit(50).all()

    unread_count = sum(1 for n in notifs if not n.is_read)

    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "message": n.message,
                "isRead": n.is_read,
                "link": n.link,
                "createdAt": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
        "unreadCount": unread_count,
    }

@router.put("/{id}/read")
def mark_read(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == id, Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}

@router.put("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}

@router.delete("/")
def clear_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Notifications cleared"}
