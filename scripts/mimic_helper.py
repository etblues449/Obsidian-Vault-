#!/usr/bin/env python3
"""
Mimic Helper for JARVIS Integration

Provides utilities for loading and using generated mimic clients.
"""

import importlib.util
import sys
from pathlib import Path


GENERATED_CLIENTS_DIR = Path(__file__).parent / "generated_clients"


def load_client(client_name: str, client_class: str = None):
    """
    Load a generated mimic client module.

    Args:
        client_name: Name of the client (e.g., 'hinge_client')
        client_class: Optional class name within the module (auto-detected if None)

    Returns:
        Loaded client class ready to instantiate

    Example:
        >>> Hinge = load_client('hinge_client', 'Hinge')
        >>> client = Hinge()
        >>> recs = client.get_recommendations()
    """
    client_path = GENERATED_CLIENTS_DIR / f"{client_name}.py"

    if not client_path.exists():
        raise FileNotFoundError(f"Client not found: {client_path}")

    spec = importlib.util.spec_from_file_location(client_name, client_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[client_name] = module
    spec.loader.exec_module(module)

    if client_class:
        return getattr(module, client_class)

    # Auto-detect: find first class that looks like a client
    for name, obj in vars(module).items():
        if isinstance(obj, type) and not name.startswith('_'):
            return obj

    raise ValueError(f"No client class found in {client_name}")


def list_available_clients():
    """List all generated client modules in generated_clients/."""
    if not GENERATED_CLIENTS_DIR.exists():
        return []

    return [
        f.stem for f in GENERATED_CLIENTS_DIR.glob("*.py")
        if not f.name.startswith('_')
    ]


def get_client_docs(client_name: str) -> str:
    """Get docstring from a generated client."""
    Client = load_client(client_name)
    return Client.__doc__ or "No documentation available"


if __name__ == "__main__":
    print("Available Mimic Clients:")
    clients = list_available_clients()
    if clients:
        for client in clients:
            print(f"  - {client}")
    else:
        print("  (none yet — run 'mimic gen' to create clients)")
