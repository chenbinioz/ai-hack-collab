import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use a valid free model
model = genai.GenerativeModel("gemini-2.5-flash")

def match_students(students):
    profiles = "\n".join([
        f"Student {s['id']}: {s['name']} | "
        f"Skills: {s['skills']} | "
        f"Style: {s['working_style']} | "
        f"Goals: {s['goals']}"
        for s in students
    ])

    prompt = (
        "You are a collaboration coach forming balanced student project groups.\n\n"
        "Student profiles:\n"
        + profiles +
        "\n\nForm groups of 3-4 with complementary skills and compatible working styles.\n"
        "Return ONLY valid JSON like:\n"
        '{"groups": [{"members": [1,2,3], "reason": "..."}]}'
    )

    response = model.generate_content(prompt)

    return response.text