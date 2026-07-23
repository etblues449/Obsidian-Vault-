#!/usr/bin/env python3
"""YouTube → NotebookLM → Vault Research Pipeline Orchestrator

Combines YouTube search + NotebookLM analysis + Obsidian storage into one workflow.
This demonstrates the "research monster" pattern from the video.

Usage:
    python youtube-pipeline-orchestrator.py \
        --query "Claude Code MCP servers" \
        --analysis gaps \
        --deliverable infographic \
        --limit 5
"""

import json
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from client import NotebookLMClient
from mcp_bridge import ObsidianVault


class YouTubePipelineOrchestrator:
    """Orchestrates complete research workflow"""

    def __init__(self, vault_root: Optional[str] = None):
        self.vault = ObsidianVault(vault_root)
        self.client = NotebookLMClient()
        self.research_dir = self.vault.root / "Research" / "YouTube"
        self.research_dir.mkdir(parents=True, exist_ok=True)

    def search_youtube(self, query: str, limit: int = 5) -> list[dict]:
        """
        Simulate YouTube search (would use youtube-search skill in real implementation)
        Returns structured video data
        """
        print(f"🔍 Searching YouTube for: {query}")
        print(f"   Limit: {limit} videos")

        # In real implementation, this would call the youtube-search skill
        # For now, return mock data structure
        videos = [
            {
                "title": f"Video {i+1}: {query}",
                "channel": f"Channel {chr(65+i)}",
                "url": f"https://youtube.com/watch?v=video{i+1}",
                "views": 50000 - (i * 5000),
                "duration": 900 + (i * 120),
                "upload_date": "2024-07-20",
                "description": f"Detailed discussion about {query}"
            }
            for i in range(min(limit, 5))
        ]

        print(f"✓ Found {len(videos)} videos\n")
        return videos

    def create_notebook(self, query: str, videos: list[dict]) -> Optional[str]:
        """Create NotebookLM notebook from video sources"""
        print(f"📓 Creating NotebookLM notebook: '{query}'")

        # Combine video URLs into notebook source
        urls = "\n".join([f"- {v['url']}" for v in videos])
        source = f"Research Topic: {query}\n\nVideo Sources:\n{urls}"

        notebook = self.client.create_notebook(
            source=source,
            title=f"Research: {query}",
            description=f"Automated analysis of {len(videos)} YouTube videos"
        )

        if notebook:
            print(f"✓ Notebook created: {notebook.id}\n")
            return notebook.id
        else:
            print("✗ Failed to create notebook\n")
            return None

    def analyze(
        self,
        notebook_id: str,
        analysis_type: str
    ) -> dict:
        """
        Analyze notebook with specified focus
        In production, NotebookLM would do this analysis
        """
        print(f"🔬 Running {analysis_type} analysis...")

        analysis_prompts = {
            "gaps": "What information is missing or not covered? What are content gaps?",
            "trends": "What patterns and trends emerge across these videos?",
            "competitive": "What is the competitive landscape? Who are the players?",
            "opportunities": "What actionable opportunities and next steps exist?",
            "content-performance": "What drives views and engagement?",
            "comprehensive": "Provide complete analysis: trends, gaps, opportunities, landscape."
        }

        prompt = analysis_prompts.get(
            analysis_type,
            "Provide comprehensive analysis"
        )

        # In real implementation, this would query NotebookLM
        # For now, return structured analysis response
        analysis = {
            "type": analysis_type,
            "findings": [
                f"Finding 1 for {analysis_type}",
                f"Finding 2 for {analysis_type}",
                f"Finding 3 for {analysis_type}",
            ],
            "opportunities": [
                "Opportunity 1",
                "Opportunity 2",
                "Opportunity 3",
            ],
            "gaps": [
                "Gap 1",
                "Gap 2",
            ],
            "key_insights": f"Key insight about {analysis_type}"
        }

        print(f"✓ Analysis complete: {len(analysis['findings'])} findings\n")
        return analysis

    def generate_deliverable(
        self,
        notebook_id: str,
        deliverable_type: str
    ) -> Optional[dict]:
        """Generate deliverable from notebook"""
        print(f"📊 Generating {deliverable_type}...")

        podcast = self.client.generate_podcast(notebook_id)

        if podcast:
            print(f"✓ Generated: {podcast.title}\n")
            return podcast.to_dict()
        else:
            print("✗ Deliverable generation pending (try later)\n")
            return None

    def save_to_vault(
        self,
        query: str,
        videos: list[dict],
        analysis: dict,
        deliverable: Optional[dict],
        analysis_type: str
    ) -> Path:
        """Save research results to Obsidian vault"""
        print("💾 Saving to Obsidian vault...")

        # Create markdown content
        timestamp = datetime.now().isoformat()
        date_str = datetime.now().strftime("%Y-%m-%d")
        filename = f"{date_str}_{query.lower().replace(' ', '-')}.md"
        filepath = self.research_dir / filename

        # Build markdown
        lines = [
            "---",
            f"tags: [research, youtube-analysis, {', '.join(query.split()[:3])}]",
            f"date: {date_str}",
            f"query: \"{query}\"",
            f"videos_analyzed: {len(videos)}",
            f"analysis_type: {analysis_type}",
            f"deliverables: [{', '.join([d.get('type', 'video') for d in ([deliverable] if deliverable else [])])}]",
            "---",
            "",
            f"# YouTube Research: {query}",
            "",
            f"**Generated:** {timestamp}",
            f"**Analysis Type:** {analysis_type}",
            f"**Videos Analyzed:** {len(videos)}",
            "",
        ]

        # Add analysis
        lines.extend([
            "## Key Findings",
            ""
        ])
        for finding in analysis.get("findings", []):
            lines.append(f"- {finding}")

        lines.extend([
            "",
            "## Opportunities",
            ""
        ])
        for opp in analysis.get("opportunities", []):
            lines.append(f"- {opp}")

        lines.extend([
            "",
            "## Gaps Identified",
            ""
        ])
        for gap in analysis.get("gaps", []):
            lines.append(f"- {gap}")

        # Add video list
        lines.extend([
            "",
            "## Videos Analyzed",
            ""
        ])
        for i, video in enumerate(videos, 1):
            lines.append(f"{i}. **{video['title']}**")
            lines.append(f"   - Channel: {video['channel']}")
            lines.append(f"   - Views: {video['views']:,}")
            lines.append(f"   - URL: {video['url']}")

        # Write file
        filepath.write_text("\n".join(lines), encoding="utf-8")
        print(f"✓ Saved to: {filepath.relative_to(self.vault.root)}\n")

        return filepath

    def run(
        self,
        query: str,
        analysis_type: str = "comprehensive",
        deliverable_type: str = "infographic",
        limit: int = 5
    ) -> dict:
        """Execute complete pipeline"""
        print("\n" + "="*60)
        print("🚀 YOUTUBE PIPELINE ORCHESTRATOR")
        print("="*60 + "\n")

        # Step 1: Search
        videos = self.search_youtube(query, limit)

        # Step 2: Create notebook
        notebook_id = self.create_notebook(query, videos)
        if not notebook_id:
            print("❌ Pipeline failed: Could not create notebook")
            return {"success": False, "error": "notebook creation failed"}

        # Step 3: Analyze
        analysis = self.analyze(notebook_id, analysis_type)

        # Step 4: Generate deliverable
        deliverable = None
        if deliverable_type != "none":
            deliverable = self.generate_deliverable(notebook_id, deliverable_type)

        # Step 5: Save to vault
        filepath = self.save_to_vault(query, videos, analysis, deliverable, analysis_type)

        print("="*60)
        print("✅ PIPELINE COMPLETE")
        print("="*60)
        print(f"\n📚 Research saved to vault")
        print(f"📊 {len(videos)} videos analyzed")
        print(f"🔬 Analysis type: {analysis_type}")
        print(f"📄 Deliverables: {deliverable_type}")

        return {
            "success": True,
            "query": query,
            "videos_analyzed": len(videos),
            "notebook_id": notebook_id,
            "analysis": analysis,
            "file": str(filepath.relative_to(self.vault.root))
        }


def main():
    parser = argparse.ArgumentParser(
        description="YouTube research pipeline: Search → Analyze → Save"
    )
    parser.add_argument("--query", required=True, help="YouTube search query")
    parser.add_argument(
        "--analysis",
        default="comprehensive",
        choices=["gaps", "trends", "competitive", "content-performance", "opportunities", "comprehensive"],
        help="Analysis type"
    )
    parser.add_argument(
        "--deliverable",
        default="infographic",
        choices=["podcast", "infographic", "mindmap", "flashcards", "studyguide", "none"],
        help="Deliverable type to generate"
    )
    parser.add_argument("--limit", type=int, default=5, help="Max videos to analyze")

    args = parser.parse_args()

    # Run pipeline
    orchestrator = YouTubePipelineOrchestrator()
    result = orchestrator.run(
        query=args.query,
        analysis_type=args.analysis,
        deliverable_type=args.deliverable,
        limit=args.limit
    )

    # Output result
    print(f"\n📋 Result: {json.dumps(result, indent=2)}")
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
