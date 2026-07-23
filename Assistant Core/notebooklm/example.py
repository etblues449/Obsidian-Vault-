#!/usr/bin/env python3
"""Example usage of NotebookLM integration

This script demonstrates how to use the NotebookLMClient to:
1. Check authentication status
2. Authenticate if needed
3. List existing notebooks
4. Create a new notebook
5. Generate a podcast summary
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from notebooklm import NotebookLMClient


def main():
    """Run NotebookLM integration example"""

    print("=== NotebookLM Integration Example ===\n")

    # Initialize client
    client = NotebookLMClient()
    print("✓ NotebookLM client initialized\n")

    # Check authentication
    print("Checking authentication status...")
    auth_status = client.check_auth_status()
    print(f"  Authenticated: {auth_status.authenticated}")
    if auth_status.user_email:
        print(f"  User: {auth_status.user_email}")
    print()

    # Authenticate if needed
    if not client.is_authenticated():
        print("Not authenticated. Starting authentication flow...")
        if client.authenticate():
            print("✓ Authentication successful\n")
        else:
            print("✗ Authentication failed")
            return

    # List existing notebooks
    print("Fetching list of notebooks...")
    notebooks = client.list_notebooks()
    print(f"Found {len(notebooks)} notebook(s)")
    for nb in notebooks:
        print(f"  - {nb.title} (ID: {nb.id})")
    print()

    # Example: Create a notebook from URL
    print("Creating a test notebook from a URL...")
    url = "https://www.example.com"
    new_notebook = client.create_notebook(
        source=url,
        title="Example Notebook",
        description="Created via NotebookLM Python integration"
    )

    if new_notebook:
        print(f"✓ Created notebook: {new_notebook.title} (ID: {new_notebook.id})\n")

        # Generate podcast
        print("Generating podcast summary...")
        podcast = client.generate_podcast(new_notebook.id)
        if podcast:
            print(f"✓ Generated podcast: {podcast.title}")
            print(f"  Duration: {podcast.duration_seconds} seconds")
            if podcast.audio_url:
                print(f"  URL: {podcast.audio_url}")
            print()
        else:
            print("✗ Failed to generate podcast\n")

        # Get updated notebook info
        print("Fetching updated notebook info...")
        updated = client.get_notebook(new_notebook.id)
        if updated:
            print(f"  Title: {updated.title}")
            print(f"  Notes: {updated.notes_count}")
            print(f"  Citations: {updated.citations_count}")
    else:
        print("✗ Failed to create notebook\n")

    print("=== Example Complete ===")


if __name__ == "__main__":
    main()
