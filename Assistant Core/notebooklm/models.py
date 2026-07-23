"""Data models for NotebookLM API responses"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime


@dataclass
class Notebook:
    """Represents a NotebookLM notebook"""
    id: str
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    source_url: Optional[str] = None
    source_file: Optional[str] = None
    description: Optional[str] = None
    notes_count: int = 0
    citations_count: int = 0
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "source_url": self.source_url,
            "source_file": self.source_file,
            "description": self.description,
            "notes_count": self.notes_count,
            "citations_count": self.citations_count,
            "tags": self.tags,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Notebook":
        """Create from dictionary"""
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
            source_url=data.get("source_url"),
            source_file=data.get("source_file"),
            description=data.get("description"),
            notes_count=data.get("notes_count", 0),
            citations_count=data.get("citations_count", 0),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {})
        )


@dataclass
class PodcastSummary:
    """Represents a generated audio podcast summary"""
    id: str
    notebook_id: str
    title: str
    duration_seconds: int
    audio_url: Optional[str] = None
    transcript: Optional[str] = None
    created_at: Optional[str] = None
    speakers: List[str] = field(default_factory=list)
    key_points: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "notebook_id": self.notebook_id,
            "title": self.title,
            "duration_seconds": self.duration_seconds,
            "audio_url": self.audio_url,
            "transcript": self.transcript,
            "created_at": self.created_at,
            "speakers": self.speakers,
            "key_points": self.key_points,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PodcastSummary":
        """Create from dictionary"""
        return cls(
            id=data.get("id", ""),
            notebook_id=data.get("notebook_id", ""),
            title=data.get("title", ""),
            duration_seconds=data.get("duration_seconds", 0),
            audio_url=data.get("audio_url"),
            transcript=data.get("transcript"),
            created_at=data.get("created_at"),
            speakers=data.get("speakers", []),
            key_points=data.get("key_points", []),
            metadata=data.get("metadata", {})
        )


@dataclass
class Document:
    """Represents a document source for notebook creation"""
    source_type: str  # "file", "url", or "text"
    content: str
    title: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_file(cls, filepath: str, title: Optional[str] = None) -> "Document":
        """Create from file path"""
        return cls(
            source_type="file",
            content=filepath,
            title=title
        )

    @classmethod
    def from_url(cls, url: str, title: Optional[str] = None) -> "Document":
        """Create from URL"""
        return cls(
            source_type="url",
            content=url,
            title=title
        )

    @classmethod
    def from_text(cls, text: str, title: str) -> "Document":
        """Create from raw text"""
        return cls(
            source_type="text",
            content=text,
            title=title
        )
