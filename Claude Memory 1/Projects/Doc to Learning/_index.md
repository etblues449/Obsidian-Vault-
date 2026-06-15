# Doc to Learning — Project Index

## Goal
Single-file HTML app that converts uploaded documents (PDF/Word) into Podcast Scripts, Video Scripts, or Interactive Lesson Plans via the Anthropic API. Built for academic/coursework use.

## Status
- App built and functional
- Source material: Cost Management notes (product lifecycle, target costing, value analysis, lifecycle costing)
- Note: Claude inside the artifact UI cannot trigger Generate remotely — user must click the button themselves

## Key Decisions
- Single-file HTML architecture (no backend)
- Direct Anthropic API integration (model: claude-sonnet-4)
- Editorial aesthetic: DM Serif Display, DM Mono, Instrument Sans; warm paper-toned palette (rust, sage, cream)
- Drag-and-drop PDF/Word upload, tab-based format selection, copy-to-clipboard

## Next Actions
- [ ] Add any new Cost Management modules as source material
- [ ] Expand format options if new output types needed

## Reference
Full detail: [[doc_to_learning]]
