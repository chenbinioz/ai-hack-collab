import sqlite3

# Creates the database table on first run.
# If it already exists, does nothing.
def init_db():
    conn = sqlite3.connect("cohort.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            skills TEXT,
            working_style TEXT,
            availability TEXT,
            goals TEXT
        )
    """)
    conn.commit()
    conn.close()

# Saves one student profile to the database.
# data is a dictionary e.g. {"name": "Ada", "skills": "maths"}
def save_student(data):
    conn = sqlite3.connect("cohort.db")
    conn.execute(
        "INSERT INTO students VALUES (NULL,?,?,?,?,?)",
        (data["name"], data["skills"],
         data["working_style"], data["availability"],
         data["goals"])
    )
    conn.commit()
    conn.close()

# Loads every student from the database as a list.
def get_all_students():
    conn = sqlite3.connect("cohort.db")
    rows = conn.execute("SELECT * FROM students").fetchall()
    conn.close()
    return [
        {"id":r[0], "name":r[1], "skills":r[2],
         "working_style":r[3], "availability":r[4],
         "goals":r[5]}
        for r in rows
    ]
    