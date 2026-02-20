from typing import List, Tuple


MINUTES_PER_DAY = 24 * 60


def hm_to_minutes(hm: str) -> int:
    hour, minute = map(int, hm.split(":"))
    return hour * 60 + minute


def add_minutes(start_hm: str, duration_minutes: int) -> str:
    total_minutes = (hm_to_minutes(start_hm) + int(duration_minutes)) % MINUTES_PER_DAY
    hour = total_minutes // 60
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def normalize_interval(start_hm: str, end_hm: str) -> List[Tuple[int, int]]:
    start_min = hm_to_minutes(start_hm)
    end_min = hm_to_minutes(end_hm)

    if end_min <= start_min:
        return [(start_min, MINUTES_PER_DAY), (0, end_min)]

    return [(start_min, end_min)]


def intervals_overlap(start_a_hm: str, end_a_hm: str, start_b_hm: str, end_b_hm: str) -> bool:
    a_ranges = normalize_interval(start_a_hm, end_a_hm)
    b_ranges = normalize_interval(start_b_hm, end_b_hm)

    for a_start, a_end in a_ranges:
        for b_start, b_end in b_ranges:
            if max(a_start, b_start) < min(a_end, b_end):
                return True

    return False
