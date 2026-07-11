"""Load and query the course catalogue (config/courses.yaml)."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class Course:
    canonical: str
    interval_months: int
    aliases: list[str] = field(default_factory=list)


@dataclass
class Catalogue:
    courses: list[Course]
    expiring_soon_days: int = 60
    default_interval_months: int = 12
    fuzzy_threshold: int = 84
    # alias (lowercased) -> Course, built for O(1) exact lookups
    _alias_index: dict[str, Course] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for course in self.courses:
            self._alias_index[course.canonical.lower()] = course
            for alias in course.aliases:
                self._alias_index[alias.lower().strip()] = course

    def exact_match(self, text: str) -> Course | None:
        return self._alias_index.get(text.lower().strip())

    @property
    def alias_to_course(self) -> dict[str, Course]:
        return self._alias_index


def load_catalogue(path: str | Path) -> Catalogue:
    data = yaml.safe_load(Path(path).read_text())
    settings = data.get("settings", {})
    courses = [
        Course(
            canonical=c["canonical"],
            interval_months=int(c.get("interval_months", settings.get("default_interval_months", 12))),
            aliases=list(c.get("aliases", [])),
        )
        for c in data.get("courses", [])
    ]
    return Catalogue(
        courses=courses,
        expiring_soon_days=int(settings.get("expiring_soon_days", 60)),
        default_interval_months=int(settings.get("default_interval_months", 12)),
        fuzzy_threshold=int(settings.get("fuzzy_threshold", 84)),
    )
