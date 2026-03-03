import os
from pathlib import Path


def get_edi_storage_dir() -> Path:
    """Retorna o diretório persistente para banco, uploads e configs locais."""
    custom_storage = os.getenv("EDI_STORAGE_DIR")
    if custom_storage:
        return Path(custom_storage).expanduser().resolve()

    home_dir = Path.home()
    candidate_dirs = [
        home_dir / "Documents" / "EDI",
        home_dir / "documents" / "EDI",
        home_dir / "Documents",
        home_dir / "documents",
    ]

    for directory in candidate_dirs:
        if (directory / "lifemanager.db").exists() or (directory / "uploads").exists():
            return directory

    for directory in candidate_dirs:
        if directory.exists():
            if directory.name.lower() == "edi":
                return directory
            return directory / "EDI"

    return home_dir / "Documents" / "EDI"
