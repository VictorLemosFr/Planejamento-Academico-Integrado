def course_status(course, current_period, completed, planned, missing):
    if course["id"] in completed:
        return "completed"
    if missing:
        return "locked"
    if course["id"] in planned:
        return "planned"
    if course["type"] == "mandatory" and course["period"] < current_period:
        return "pending"
    return "available"
