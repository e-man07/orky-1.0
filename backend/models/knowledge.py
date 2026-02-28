from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    number = Column(String, unique=True, nullable=False)
    short_description = Column(String, nullable=False)
    article_body = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    workflow = Column(String, nullable=True)
    source = Column(String, default="excel")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    criteria = relationship("ArticleCriteria", back_populates="article", cascade="all, delete-orphan")
    chunks = relationship("ArticleChunk", back_populates="article", cascade="all, delete-orphan")


class ArticleChunk(Base):
    __tablename__ = "article_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    article_id = Column(Integer, ForeignKey("knowledge_articles.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_size = Column(Integer, nullable=False)
    preceding_context = Column(Text, nullable=True)
    following_context = Column(Text, nullable=True)
    embedding = Column(Vector(3072), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    article = relationship("KnowledgeArticle", back_populates="chunks")


class ArticleCriteria(Base):
    __tablename__ = "article_criteria"

    article_id = Column(Integer, ForeignKey("knowledge_articles.id", ondelete="CASCADE"), primary_key=True)
    criteria_id = Column(Integer, ForeignKey("user_criteria.id", ondelete="CASCADE"), primary_key=True)

    article = relationship("KnowledgeArticle", back_populates="criteria")
    criteria = relationship("UserCriteria", back_populates="articles")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="New Chat")
    pending_workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    embedding = Column(Vector(3072), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    session = relationship("ChatSession", back_populates="messages")


class Execution(Base):
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(String, nullable=True)
    user_prompt = Column(String, nullable=False)
    status = Column(String, default="pending")
    agent_type = Column(String, nullable=True)
    conversational_response = Column(Text, nullable=True)
    sources = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="executions")
    logs = relationship("AgentLog", back_populates="execution", cascade="all, delete-orphan")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False)
    agent_type = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    execution = relationship("Execution", back_populates="logs")


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String, nullable=False)
    status = Column(String, default="pending")
    items_synced = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
