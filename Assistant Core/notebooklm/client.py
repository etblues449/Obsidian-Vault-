"""NotebookLM API Client using notebooklm-py CLI wrapper"""

import json
import subprocess
from typing import List, Optional
from .auth import AuthManager, AuthStatus
from .models import Notebook, PodcastSummary, Document


class NotebookLMClient:
    """Client for interacting with Google NotebookLM service

    This client wraps the notebooklm-py CLI tool to provide a Python interface.
    """

    def __init__(self):
        """Initialize the NotebookLM client"""
        self.auth_manager = AuthManager()

    def is_authenticated(self) -> bool:
        """Check if user is currently authenticated

        Returns:
            bool: True if authenticated
        """
        return self.auth_manager.is_authenticated()

    def authenticate(self) -> bool:
        """Trigger authentication flow

        Returns:
            bool: True if authentication successful
        """
        print("Starting Google OAuth flow...")
        success = self.auth_manager.authenticate()
        if success:
            status = self.auth_manager.check_status()
            print(f"Authenticated as: {status.user_email}")
        return success

    def check_auth_status(self) -> AuthStatus:
        """Get detailed authentication status

        Returns:
            AuthStatus: Current authentication status
        """
        return self.auth_manager.check_status()

    def list_notebooks(self) -> List[Notebook]:
        """List all notebooks

        Returns:
            List[Notebook]: List of notebooks
        """
        try:
            result = subprocess.run(
                ["notebooklm", "list"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                print(f"Error listing notebooks: {result.stderr}")
                return []

            try:
                notebooks_data = json.loads(result.stdout)
                if isinstance(notebooks_data, list):
                    return [Notebook.from_dict(nb) for nb in notebooks_data]
                elif isinstance(notebooks_data, dict) and "notebooks" in notebooks_data:
                    return [Notebook.from_dict(nb) for nb in notebooks_data["notebooks"]]
                return []
            except json.JSONDecodeError:
                print("Failed to parse notebooks response")
                return []

        except subprocess.TimeoutExpired:
            print("Timeout listing notebooks")
            return []
        except Exception as e:
            print(f"Error listing notebooks: {e}")
            return []

    def create_notebook(self, source: str, title: str, description: Optional[str] = None) -> Optional[Notebook]:
        """Create a new notebook from a source

        Args:
            source: File path, URL, or text content
            title: Title for the notebook
            description: Optional description

        Returns:
            Notebook: Created notebook object, or None if failed
        """
        try:
            cmd = ["notebooklm", "create", "--source", source, "--title", title]
            if description:
                cmd.extend(["--description", description])

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minutes for notebook creation
            )

            if result.returncode == 0:
                try:
                    notebook_data = json.loads(result.stdout)
                    return Notebook.from_dict(notebook_data)
                except json.JSONDecodeError:
                    print("Failed to parse created notebook response")
                    return None
            else:
                print(f"Error creating notebook: {result.stderr}")
                return None

        except subprocess.TimeoutExpired:
            print("Timeout creating notebook")
            return None
        except Exception as e:
            print(f"Error creating notebook: {e}")
            return None

    def get_notebook(self, notebook_id: str) -> Optional[Notebook]:
        """Get notebook details by ID

        Args:
            notebook_id: ID of the notebook

        Returns:
            Notebook: Notebook object, or None if not found
        """
        try:
            result = subprocess.run(
                ["notebooklm", "get", notebook_id],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                try:
                    notebook_data = json.loads(result.stdout)
                    return Notebook.from_dict(notebook_data)
                except json.JSONDecodeError:
                    print("Failed to parse notebook response")
                    return None
            else:
                print(f"Error getting notebook: {result.stderr}")
                return None

        except Exception as e:
            print(f"Error getting notebook: {e}")
            return None

    def generate_podcast(self, notebook_id: str) -> Optional[PodcastSummary]:
        """Generate audio podcast summary for a notebook

        Args:
            notebook_id: ID of the notebook

        Returns:
            PodcastSummary: Generated podcast summary, or None if failed
        """
        try:
            result = subprocess.run(
                ["notebooklm", "podcast", notebook_id],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )

            if result.returncode == 0:
                try:
                    podcast_data = json.loads(result.stdout)
                    return PodcastSummary.from_dict(podcast_data)
                except json.JSONDecodeError:
                    print("Failed to parse podcast response")
                    return None
            else:
                print(f"Error generating podcast: {result.stderr}")
                return None

        except subprocess.TimeoutExpired:
            print("Timeout generating podcast")
            return None
        except Exception as e:
            print(f"Error generating podcast: {e}")
            return None

    def delete_notebook(self, notebook_id: str) -> bool:
        """Delete a notebook

        Args:
            notebook_id: ID of the notebook to delete

        Returns:
            bool: True if deletion successful
        """
        try:
            result = subprocess.run(
                ["notebooklm", "delete", notebook_id],
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0

        except Exception as e:
            print(f"Error deleting notebook: {e}")
            return False

    def logout(self) -> bool:
        """Logout and clear cached credentials

        Returns:
            bool: True if logout successful
        """
        return self.auth_manager.logout()
