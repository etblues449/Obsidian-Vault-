# Mimic Global Setup Guide

**Mimic is available globally across all your repos.**

## Global Location
- **CLI:** `mimic` (works anywhere)
- **Python Helper:** `~/.jarvis/mimic/mimic_global.py`
- **Bash Setup:** `source ~/.jarvis/mimic/mimic.env.sh`
- **Generated Clients:** `~/.jarvis/mimic/generated_clients/`

## Quick Usage from Any Repo

### Python
```python
from mimic_global import load_client

Client = load_client('hinge_client', 'Hinge')
app = Client()
recommendations = app.get_recommendations()
```

### Bash
```bash
source ~/.jarvis/mimic/mimic.env.sh
mimic-gen prod-api.example.com
mimic-clients  # List all generated clients
```

## First Time Setup

1. Record app traffic:
   ```bash
   mimic record
   ```

2. Generate client:
   ```bash
   mimic gen prod-api.example.com
   ```

3. Use in any repo:
   ```python
   from mimic_global import load_client
   Client = load_client('prod_api_example_client')
   ```

## Full Documentation
See `~/.jarvis/mimic/README.md` for complete reference.

---
**Last Updated:** 2026-07-17
