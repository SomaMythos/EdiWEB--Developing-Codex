from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
import random
import json

MINUTES_PER_DAY = 24 * 60


# ---------- Conversores ----------
def hm_to_min(hm: str) -> int:
    h, m = map(int, hm.split(":"))
    return h * 60 + m


def min_to_hm(m: int) -> str:
    m = m % MINUTES_PER_DAY
    h = m // 60
    mm = m % 60
    return f"{h:02d}:{mm:02d}"


# ---------- Tipos ----------
@dataclass
class FixedEvent:
    id: str
    name: str
    start: int
    end: int
    category: str = "fixed"
    meta: Optional[Dict[str, Any]] = None


@dataclass
class ActivityTemplate:
    id: str
    name: str
    category: str
    min_duration: int
    max_duration: int
    priority: int = 5
    preferred_windows: Optional[List[Tuple[int, int]]] = None
    active: bool = True
    meta: Optional[Dict[str, Any]] = None


@dataclass
class ScheduledItem:
    name: str
    start: int
    end: int
    category: str
    source_id: Optional[str] = None
    reason: Optional[str] = None


@dataclass
class NotScheduled:
    source_id: str
    name: str
    reason: str


# ---------- Engine ----------
class DayEngine:

    def __init__(
        self,
        buffer_between: int = 10,
        granularity_min: int = 1,
        seed: Optional[int] = None,
        avoid_category_adjacent: bool = True,
    ):
        self.buffer = max(0, int(buffer_between))
        self.gran = max(1, int(granularity_min))
        self.avoid_cat = bool(avoid_category_adjacent)

        if seed is not None:
            random.seed(seed)

    # ==========================================
    # FREE INTERVALS (CORRETO)
    # ==========================================
    def _build_free(self, fixed: List[FixedEvent]) -> List[Tuple[int, int]]:
        intervals = [(0, MINUTES_PER_DAY)]

        for ev in sorted(fixed, key=lambda e: e.start):

            new = []

            # SONO NÃO RECEBE BUFFER
            if ev.category == "sleep":
                rem_s = ev.start
                rem_e = ev.end
            else:
                rem_s = ev.start - self.buffer
                rem_e = ev.end + self.buffer

            for a, b in intervals:
                if rem_e <= a or rem_s >= b:
                    new.append((a, b))
                else:
                    if a < rem_s:
                        new.append((a, rem_s))
                    if rem_e < b:
                        new.append((rem_e, b))

            intervals = new

        # merge
        merged = []
        for s, e in sorted(intervals):
            if e - s < self.gran:
                continue
            if not merged or s > merged[-1][1]:
                merged.append((s, e))
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], e))

        return merged

    def _fits(self, interval: Tuple[int, int], dur: int) -> bool:
        s, e = interval
        return (e - s) >= dur

    def _subtract_interval(self, free, start, end, category):
        if category == "sleep":
            rem_s = start
            rem_e = end
        else:
            rem_s = start - self.buffer
            rem_e = end + self.buffer

        new = []
        for a, b in free:
            if rem_e <= a or rem_s >= b:
                new.append((a, b))
            else:
                if a < rem_s:
                    new.append((a, rem_s))
                if rem_e < b:
                    new.append((rem_e, b))
        return new

    # ==========================================
    # ALLOCATE
    # ==========================================
    def allocate(
        self,
        fixed_events: List[FixedEvent],
        templates: List[ActivityTemplate],
    ):

        scheduled = []
        for ev in fixed_events:
            scheduled.append(
                ScheduledItem(
                    ev.name,
                    ev.start,
                    ev.end,
                    ev.category,
                    source_id=ev.id,
                    reason="fixed",
                )
            )

        free = self._build_free(fixed_events)

        tasks = [t for t in templates if t.active]
        tasks.sort(key=lambda t: -t.priority)

        not_scheduled = []

        for t in tasks:

            dur = t.min_duration

            placed = False

            for interval in free:
                if self._fits(interval, dur):

                    start = interval[0]
                    end = start + dur

                    scheduled.append(
                        ScheduledItem(
                            t.name,
                            start,
                            end,
                            t.category,
                            source_id=t.id,
                            reason="placed",
                        )
                    )

                    free = self._subtract_interval(free, start, end, t.category)
                    placed = True
                    break

            if not placed:
                not_scheduled.append(
                    NotScheduled(t.id, t.name, "no_slot")
                )

        scheduled.sort(key=lambda x: x.start)

        diagnostics = {
            "free_intervals_final": free,
            "total_fill_minutes": sum(s.end - s.start for s in scheduled),
        }

        return scheduled, not_scheduled, diagnostics


# ==========================================
# PUBLIC FUNCTION
# ==========================================
def generate_day_schedule(
    fixed_events_json: List[Dict[str, Any]],
    templates_json: List[Dict[str, Any]],
    *,
    buffer_between: int = 10,
    granularity_min: int = 1,
    seed: Optional[int] = None,
    avoid_category_adjacent: bool = True,
):

    fixed_events = []

    for fe in fixed_events_json:
        s = hm_to_min(fe["start_hm"])
        e = hm_to_min(fe["end_hm"])

        if e <= s:
            # cruza meia-noite
            fixed_events.append(
                FixedEvent(
                    fe["id"] + "_p1",
                    fe["name"],
                    s,
                    MINUTES_PER_DAY,
                    fe.get("category", "fixed"),
                )
            )
            fixed_events.append(
                FixedEvent(
                    fe["id"] + "_p2",
                    fe["name"],
                    0,
                    e,
                    fe.get("category", "fixed"),
                )
            )
        else:
            fixed_events.append(
                FixedEvent(
                    fe["id"],
                    fe["name"],
                    s,
                    e,
                    fe.get("category", "fixed"),
                )
            )

    templates = []
    for t in templates_json:
        templates.append(
            ActivityTemplate(
                id=str(t["id"]),
                name=t["name"],
                category=t["category"],
                min_duration=int(t["min_duration"]),
                max_duration=int(t["max_duration"]),
                priority=int(t.get("priority", 5)),
            )
        )

    engine = DayEngine(
        buffer_between=buffer_between,
        granularity_min=granularity_min,
        seed=seed,
        avoid_category_adjacent=avoid_category_adjacent,
    )

    scheduled, not_scheduled, diagnostics = engine.allocate(
        fixed_events, templates
    )

    scheduled_out = [
        {
            "name": s.name,
            "start_hm": min_to_hm(s.start),
            "end_hm": min_to_hm(s.end),
            "start_min": s.start,
            "end_min": s.end,
            "category": s.category,
            "source_id": s.source_id,
            "reason": s.reason,
        }
        for s in scheduled
    ]

    return {
        "scheduled": scheduled_out,
        "not_scheduled": [
            {"source_id": n.source_id, "name": n.name, "reason": n.reason}
            for n in not_scheduled
        ],
        "diagnostics": diagnostics,
    }
