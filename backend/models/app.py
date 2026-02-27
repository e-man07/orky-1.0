from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, UniqueConstraint, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class App(Base):
    __tablename__ = "apps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    category = Column(String, nullable=True)
    credentials = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    actions = relationship("AppAction", back_populates="app", cascade="all, delete-orphan")


class AppAction(Base):
    __tablename__ = "app_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_id = Column(Integer, ForeignKey("apps.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    action_type = Column(String, nullable=False)
    input_schema = Column(JSON, nullable=True)
    is_enabled = Column(Boolean, default=True)

    app = relationship("App", back_populates="actions")
    agents = relationship("AgentAction", back_populates="action", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("app_id", "name"),
    )
