from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import base64
import fitz
import groq
import json
from math_solver import is_math_question, solve_math

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

import re

def clean_reply(message):
    text = message.content or ""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if not text:
        text = (message.content or "").strip()
    return text

SYSTEM = """You are a patient, friendly teacher. Your job is to take complex text and explain it simply as if talking to a curious young child who has never heard these words before.

Rules:
- Use only short everyday words. No jargon.
- Short paragraphs, 2 to 3 sentences each.
- Use simple comparisons: food, toys, family, nature.
- Be warm and encouraging.
- Never use emojis.
- When someone uploads a file, first ask them clearly what they want from it. Give them options: a full simple explanation, a short summary, just the key points, or specific questions answered. Wait for their answer before explaining anything.
- When given a specific instruction about the file, follow it thoroughly.
- If the user asks a maths, physics or logic question, actually solve it. Show the working one step at a time, explain in simple words what is happening at each step, and end with the final answer clearly on its own line, like "Answer: ...". Use the same simple everyday language as everything else."""

@app.get("/")
def root():
    return {"status": "PDF sPutta API is running"}


def build_system(prefs: str = "") -> str:
    if prefs and prefs.strip():
        return SYSTEM + "\n\n" + prefs.strip()
    return SYSTEM


def strip_json_fences(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    return raw


@app.post("/chat")
async def chat(
    message: str = Form(...),
    history: str = Form(default="[]"),
    prefs: str = Form(default=""),
):
    chat_history = json.loads(history)
    messages = [{"role": "system", "content": build_system(prefs)}]
    messages += chat_history

    user_message = message
    if is_math_question(message):
        solved = solve_math(message)
        if solved.get("success"):
            user_message = (
                f"{message}\n\n"
                f"[Verified exact answer, computed with a symbolic maths engine. "
                f"Do not recompute this yourself, do not contradict it, treat it as ground truth.]\n"
                f"Method used: {solved['method']}\n"
                f"Exact result: {solved['result_str']}\n\n"
                f"Explain step by step, in the same simple everyday style as usual, how one would arrive at this exact result. "
                f"End your reply with a clear line: Answer: {solved['result_str']}"
            )

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        max_tokens=1536,
    )

    reply = clean_reply(response.choices[0].message)
    return {"reply": reply}


@app.post("/quiz")
async def quiz(
    explanation: str = Form(...),
    prefs: str = Form(default="")
):
    quiz_prompt = f"""Based on the following explanation, create quiz questions to check if the learner understood it.

Decide how many questions to ask, based on how much there is to check in this explanation. Use a mix of question types:
- "mcq" for a question with a clear right answer among a few choices
- "open" for a question that needs a short typed answer in the learner's own words

Explanation:
{explanation}

Respond with ONLY valid JSON, no markdown fences, no extra text, in this exact shape:
{{
  "questions": [
    {{"type": "mcq", "question": "...", "options": ["...", "...", "..."], "correct_index": 0}},
    {{"type": "open", "question": "...", "expected_answer": "short description of what a correct answer should include"}}
  ]
}}"""

    messages = [
        {"role": "system", "content": build_system(prefs)},
        {"role": "user", "content": quiz_prompt}
    ]

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            max_tokens=1024,
        )
        raw = strip_json_fences(clean_reply(response.choices[0].message))
        data = json.loads(raw)
        if not data.get("questions"):
            return {"error": "Could not build questions for this."}
        return data
    except Exception:
        return {"error": "Could not build questions for this."}


@app.post("/check-answer")
async def check_answer(
    question: str = Form(...),
    question_type: str = Form(...),
    correct_answer: str = Form(...),
    user_answer: str = Form(...),
    prefs: str = Form(default="")
):
    check_prompt = f"""A learner was asked this question to check their understanding:

Question: {question}
Correct answer / what a good answer should include: {correct_answer}
Learner's answer: {user_answer}

Judge if the learner's answer is correct, partially correct, or incorrect. Then respond with ONLY valid JSON, no markdown fences, no extra text, in this exact shape:
{{
  "correct": true or false,
  "feedback": "one or two short encouraging sentences explaining why, in simple words",
  "misunderstood": "a short plain description of exactly what part they got wrong, or null if fully correct"
}}"""

    messages = [
        {"role": "system", "content": build_system(prefs)},
        {"role": "user", "content": check_prompt}
    ]

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            max_tokens=512,
        )
        raw = strip_json_fences(clean_reply(response.choices[0].message))
        data = json.loads(raw)
        return data
    except Exception:
        return {"error": "Could not check this answer."}


@app.post("/reexplain")
async def reexplain(
    original_explanation: str = Form(...),
    misunderstood_points: str = Form(...),
    prefs: str = Form(default="")
):
    reexplain_prompt = f"""Here is an explanation you gave earlier:

{original_explanation}

The learner got these specific parts wrong or misunderstood:
{misunderstood_points}

Re-explain ONLY the misunderstood parts, using a different angle or example than before so it clicks this time. Do not repeat the whole original explanation, just the parts that were misunderstood. Keep it short and simple."""

    messages = [
        {"role": "system", "content": build_system(prefs)},
        {"role": "user", "content": reexplain_prompt}
    ]

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            max_tokens=1024,
        )
        reply = clean_reply(response.choices[0].message)
        return {"reply": reply}
    except Exception as e:
        return {"error": str(e)}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename.lower()
    text = ""

    try:
        if filename.endswith(".pdf"):
            doc = fitz.open(stream=contents, filetype="pdf")
            for page in doc:
                text += page.get_text()
        elif filename.endswith(".txt"):
            text = contents.decode("utf-8")
        else:
            return {"error": "Unsupported file type."}

        if not text.strip():
            return {"error": "No readable text found in this file."}

        if len(text) > 15000:
            text = text[:15000] + "\n\n[Document truncated.]"

        return {"text": text}

    except Exception as e:
        return {"error": str(e)}


@app.post("/read-image")
async def read_image(
    file: UploadFile = File(...),
    question: str = Form(default="Read everything in this image including any text, equations, formulas or diagrams."),
    prefs: str = Form(default="")
):
    try:
        contents = await file.read()
        base64_image = base64.b64encode(contents).decode("utf-8")

        filename = file.filename.lower()
        if filename.endswith(".png"):
            media_type = "image/png"
        elif filename.endswith(".gif"):
            media_type = "image/gif"
        elif filename.endswith(".webp"):
            media_type = "image/webp"
        else:
            media_type = "image/jpeg"

        response = client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            reasoning_format="hidden",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{base64_image}"
                            }
                        },
                        {
                            "type": "text",
                            "text": f"{build_system(prefs)}\n\n{question}"
                        }
                    ]
                }
            ],
            max_tokens=3072,
        )

        reply = clean_reply(response.choices[0].message)
        return {"reply": reply}

    except Exception as e:
        return {"error": str(e)}


@app.post("/read-pdf")
async def read_pdf(
    file: UploadFile = File(...),
    question: str = Form(default="What is in this document?"),
    prefs: str = Form(default="")
):
    try:
        contents = await file.read()
        doc = fitz.open(stream=contents, filetype="pdf")
        text = ""

        for page in doc:
            text += page.get_text()

        if not text.strip():
            return {"error": "No readable text found in this PDF."}

        if len(text) > 15000:
            text = text[:15000] + "\n\n[Document truncated.]"

        math_hint = """
If this document contains mathematical or physics equations, formulas or expressions:
- Identify each equation clearly
- Explain what each symbol means in simple terms
- Solve step by step if asked
- Use simple analogies to explain the concept behind the equation
"""

        messages = [
            {"role": "system", "content": build_system(prefs) + math_hint},
            {"role": "user", "content": f"Here is the document content:\n\n{text}\n\nQuestion: {question}"}
        ]

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            max_tokens=2048,
        )

        reply = clean_reply(response.choices[0].message)
        return {"reply": reply}

    except Exception as e:
        return {"error": str(e)}