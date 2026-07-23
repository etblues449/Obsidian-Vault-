#!/usr/bin/env python3
"""MCP Bridge for bidirectional NotebookLM ↔ Obsidian Vault integration

Provides Claude with MCP tools to:
1. Read Obsidian Vault notes
2. Create/manage NotebookLM notebooks
3. Generate and sync podcast summaries back to vault
"""

import json
import logging
import sys
import asyncio
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

# Add this script's directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from mcp.server.stdio import StdioServerTransport
    from mcp.server import Server
    from mcp.types import Tool
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

try:
    from client import NotebookLMClient
    from models import Notebook, PodcastSummary
except ImportError:
    print("Error: Could not import NotebookLM client. Check installation.", file=sys.stderr)
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ObsidianVault:
    """Interface for reading/writing Obsidian Vault notes"""

    def __init__(self, vault_root: Optional[str] = None):
        if vault_root:
            self.root = Path(vault_root)
        else:
            self.root = Path(__file__).parent.parent.parent

    def get_notes_by_tag(self, tag: str) -> list[dict]:
        """Get all notes with a specific tag (e.g., #notebook)"""
        notes = []
        for md_file in self.root.rglob("*.md"):
            if any(part.startswith(".") for part in md_file.parts):
                continue
            try:
                content = md_file.read_text(encoding="utf-8")
                if f"#{tag}" in content or f'tags: *{tag}' in content:
                    title = md_file.stem
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                    notes.append({
                        "path": str(md_file.relative_to(self.root)),
                        "title": title,
                        "content": content[:500],
                        "tags": [tag]
                    })
            except Exception as e:
                logger.warning(f"Error reading {md_file}: {e}")
        return notes

    def annotate_note(self, file_path: str, section: str, annotation: str) -> bool:
        """Add annotation to a note"""
        try:
            full_path = self.root / file_path
            if not full_path.exists():
                return False
            content = full_path.read_text(encoding="utf-8")
            if section not in content:
                content += f"\n\n## {section}\n"
            timestamp = datetime.now().isoformat()
            content += f"\n- **[{timestamp}]** {annotation}"
            full_path.write_text(content, encoding="utf-8")
            return True
        except Exception as e:
            logger.error(f"Error annotating {file_path}: {e}")
            return False


async def main():
    """Start the MCP server"""
    server = Server("NotebookLM-Obsidian-Bridge")
    vault = ObsidianVault()
    client = NotebookLMClient()

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="vault_search_by_tag",
                description="Search Obsidian Vault for notes with a specific tag (e.g., #notebook)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "tag": {
                            "type": "string",
                            "description": "Tag to search for (without # symbol)"
                        }
                    },
                    "required": ["tag"]
                }
            ),
            Tool(
                name="notebooklm_create",
                description="Create a NotebookLM notebook from vault note content",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "source": {"type": "string", "description": "Note content or URL"},
                        "title": {"type": "string", "description": "Notebook title"},
                        "description": {"type": "string", "description": "Optional description"}
                    },
                    "required": ["source", "title"]
                }
            ),
            Tool(
                name="notebooklm_list",
                description="List all NotebookLM notebooks",
                inputSchema={"type": "object", "properties": {}}
            ),
            Tool(
                name="notebooklm_podcast",
                description="Generate a podcast summary for a notebook",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "notebook_id": {"type": "string", "description": "Notebook ID"}
                    },
                    "required": ["notebook_id"]
                }
            ),
            Tool(
                name="vault_annotate",
                description="Add insights from NotebookLM back to vault notes",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Path to vault note"},
                        "annotation": {"type": "string", "description": "Annotation text"},
                        "section": {"type": "string", "description": "Section heading (default: NotebookLM Insights)"}
                    },
                    "required": ["file_path", "annotation"]
                }
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> Any:
        try:
            if name == "vault_search_by_tag":
                notes = vault.get_notes_by_tag(arguments.get("tag"))
                return json.dumps({"count": len(notes), "notes": notes})

            elif name == "notebooklm_create":
                notebook = client.create_notebook(
                    source=arguments.get("source"),
                    title=arguments.get("title"),
                    description=arguments.get("description")
                )
                if notebook:
                    return json.dumps({"success": True, "notebook": notebook.to_dict()})
                return json.dumps({"success": False, "error": "Failed to create notebook"})

            elif name == "notebooklm_list":
                notebooks = client.list_notebooks()
                return json.dumps({"count": len(notebooks), "notebooks": [nb.to_dict() for nb in notebooks]})

            elif name == "notebooklm_podcast":
                podcast = client.generate_podcast(arguments.get("notebook_id"))
                if podcast:
                    return json.dumps({"success": True, "podcast": podcast.to_dict()})
                return json.dumps({"success": False, "error": "Failed to generate podcast"})

            elif name == "vault_annotate":
                success = vault.annotate_note(
                    arguments.get("file_path"),
                    arguments.get("section", "NotebookLM Insights"),
                    arguments.get("annotation")
                )
                return json.dumps({"success": success})

            return json.dumps({"error": f"Unknown tool: {name}"})
        except Exception as e:
            logger.error(f"Tool error: {e}")
            return json.dumps({"error": str(e)})

    async with server:
        logger.info("NotebookLM-Obsidian Bridge MCP server started")
        await server.wait_for_shutdown()


if __name__ == "__main__":
    asyncio.run(main())
