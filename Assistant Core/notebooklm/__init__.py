"""NotebookLM Integration for JARVIS

Provides a Python interface to interact with Google's NotebookLM service.
Supports document ingestion, notebook creation, podcast generation, and more.

Usage:
    from notebooklm import NotebookLMClient

    client = NotebookLMClient()
    if not client.is_authenticated():
        client.authenticate()

    notebook = client.create_notebook(source="path/to/document.pdf", title="My Research")
    print(f"Created notebook: {notebook.id}")
"""

from .client import NotebookLMClient
from .models import Notebook, PodcastSummary
from .auth import AuthManager

__version__ = "0.1.0"
__all__ = ["NotebookLMClient", "Notebook", "PodcastSummary", "AuthManager"]
