"""Authentication management for NotebookLM

Handles Google OAuth 2.0 authentication and credential caching.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class AuthStatus:
    """Authentication status information"""
    authenticated: bool
    user_email: Optional[str] = None
    token_valid: bool = False
    expires_at: Optional[str] = None
    last_checked: Optional[str] = None


class AuthManager:
    """Manage NotebookLM authentication via notebooklm-py CLI"""

    CREDENTIALS_DIR = Path.home() / ".notebooklm"

    def __init__(self):
        """Initialize auth manager"""
        self.credentials_dir = self.CREDENTIALS_DIR
        self.credentials_dir.mkdir(parents=True, exist_ok=True)

    def authenticate(self) -> bool:
        """Trigger Google OAuth login flow

        Returns:
            bool: True if authentication successful
        """
        try:
            result = subprocess.run(
                ["notebooklm", "login"],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes for user to complete OAuth
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print("Authentication timeout: user did not complete Google Sign-In within 5 minutes")
            return False
        except FileNotFoundError:
            print("notebooklm-py not found. Install via: uv tool install 'notebooklm-py[browser]'")
            return False

    def check_status(self) -> AuthStatus:
        """Check current authentication status

        Returns:
            AuthStatus: Current authentication status
        """
        try:
            result = subprocess.run(
                ["notebooklm", "auth", "check", "--test", "--json"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    return AuthStatus(
                        authenticated=data.get("status") == "ok",
                        user_email=data.get("user"),
                        token_valid=data.get("authenticated", False),
                        last_checked=datetime.utcnow().isoformat()
                    )
                except json.JSONDecodeError:
                    return AuthStatus(authenticated=False, last_checked=datetime.utcnow().isoformat())
            else:
                return AuthStatus(authenticated=False, last_checked=datetime.utcnow().isoformat())

        except Exception as e:
            print(f"Error checking auth status: {e}")
            return AuthStatus(authenticated=False, last_checked=datetime.utcnow().isoformat())

    def is_authenticated(self) -> bool:
        """Quick check if user is authenticated

        Returns:
            bool: True if authenticated
        """
        return self.check_status().authenticated

    def logout(self) -> bool:
        """Clear cached credentials and logout

        Returns:
            bool: True if logout successful
        """
        try:
            result = subprocess.run(
                ["notebooklm", "auth", "logout"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            print(f"Error during logout: {e}")
            return False

    def refresh(self) -> bool:
        """Refresh authentication token if expired

        Returns:
            bool: True if refresh successful
        """
        try:
            result = subprocess.run(
                ["notebooklm", "auth", "refresh"],
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0
        except Exception as e:
            print(f"Error refreshing auth: {e}")
            return False

    def get_credentials_path(self) -> Path:
        """Get path to stored credentials file

        Returns:
            Path: Path to ~/.notebooklm/credentials.json
        """
        return self.credentials_dir / "credentials.json"

    def has_local_credentials(self) -> bool:
        """Check if credentials are stored locally

        Returns:
            bool: True if credentials file exists
        """
        creds_path = self.get_credentials_path()
        return creds_path.exists()
