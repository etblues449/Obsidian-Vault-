#!/usr/bin/env python3
"""Example workflow: Vault → NotebookLM → Vault cycle

Demonstrates complete bidirectional integration:
1. Find notes tagged with #notebook
2. Create NotebookLM notebooks
3. Generate podcast summaries
4. Annotate vault notes with insights
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from client import NotebookLMClient
from mcp_bridge import ObsidianVault


def main():
    print("=== NotebookLM ↔ Vault Workflow Example ===\n")

    client = NotebookLMClient()
    vault = ObsidianVault()

    # Step 1: Find notes tagged with #notebook
    print("Step 1: Searching for #notebook tagged notes...")
    notebook_notes = vault.get_notes_by_tag("notebook")
    print(f"  Found {len(notebook_notes)} notes\n")

    if not notebook_notes:
        print("No notes tagged with #notebook. Skipping workflow.")
        return

    # Step 2: Create notebooks
    print("Step 2: Creating NotebookLM notebooks...")
    created_notebooks = []

    for note in notebook_notes[:1]:  # Process first note as example
        print(f"  Processing: {note['title']}")

        notebook = client.create_notebook(
            source=note["content"],
            title=f"Notebook: {note['title']}",
            description=f"Created from vault note: {note['path']}"
        )

        if notebook:
            print(f"  ✓ Created: {notebook.title} (ID: {notebook.id})")
            created_notebooks.append({
                "notebook": notebook,
                "vault_note": note
            })
        else:
            print(f"  ✗ Failed to create notebook")

    if not created_notebooks:
        print("\nNo notebooks created. Skipping podcast generation.")
        return

    # Step 3: Generate podcasts
    print("\nStep 3: Generating podcast summaries...")
    podcasts = []

    for item in created_notebooks:
        notebook = item["notebook"]
        print(f"  Generating for: {notebook.title}")

        podcast = client.generate_podcast(notebook.id)

        if podcast:
            print(f"  ✓ Generated: {podcast.title}")
            print(f"    Duration: {podcast.duration_seconds}s")
            if podcast.key_points:
                print(f"    Key points: {len(podcast.key_points)}")
            podcasts.append({
                "podcast": podcast,
                "vault_note": item["vault_note"]
            })
        else:
            print(f"  ✗ Failed to generate podcast")

    if not podcasts:
        print("\nNo podcasts generated. Skipping vault annotation.")
        return

    # Step 4: Annotate vault notes
    print("\nStep 4: Annotating vault notes with insights...")

    for item in podcasts:
        podcast = item["podcast"]
        vault_note = item["vault_note"]

        # Build annotation from podcast insights
        annotation = f"Podcast generated: **{podcast.title}** ({podcast.duration_seconds}s)"
        if podcast.key_points:
            points = ", ".join(podcast.key_points[:3])
            annotation += f"\n  Key insights: {points}"

        success = vault.annotate_note(
            file_path=vault_note["path"],
            section="NotebookLM Podcast Summary",
            annotation=annotation
        )

        if success:
            print(f"  ✓ Annotated: {vault_note['path']}")
        else:
            print(f"  ✗ Failed to annotate: {vault_note['path']}")

    print("\n=== Workflow Complete ===")
    print(f"Processed {len(podcast)} notes")
    print("Notes updated with podcast insights")


if __name__ == "__main__":
    main()
