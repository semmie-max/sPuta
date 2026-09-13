from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import base64
import fitz
import groq
import json

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

SYSTEM = """You are a patient, friendly teacher. Your job is to take complex text and explain it simply as if talking to a curious young child who has never heard these words before.

Rules:
- Use only short everyday words. No jargon.
- Short paragraphs, 2 to 3 sentences each.
- Use simple comparisons: food, toys, family, nature.
- Be warm and encouraging.
- Never use emojis.
- When someone uploads a file, first ask them clearly what they want from it. Give them options: a full simple explanation, a short summary, just the key points, or specific questions answered. Wait for their answer before explaining anything.
- When given a specific instruction about the file, follow it thoroughly."""


@app.get("/")
def root():
    return {"status": "PDF sPutta API is running"}


@app.post("/chat")
async def chat(
    message: str = Form(...),
    history: str = Form(default="[]"),
):
    chat_history = json.loads(history)
    messages = [{"role": "system", "content": SYSTEM}]
    messages += chat_history
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        max_tokens=1024,
    )

    reply = response.choices[0].message.content
    return {"reply": reply}


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
    question: str = Form(default="Read everything in this image including any text, equations, formulas or diagrams.")
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
                            "text": f"{SYSTEM}\n\n{question}"
                        }
                    ]
                }
            ],
            max_tokens=1024,
        )

        reply = response.choices[0].message.content
        return {"reply": reply}

    except Exception as e:
        return {"error": str(e)}


@app.post("/read-pdf")
async def read_pdf(
    file: UploadFile = File(...),
    question: str = Form(default="What is in this document?")
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
            {"role": "system", "content": SYSTEM + math_hint},
            {"role": "user", "content": f"Here is the document content:\n\n{text}\n\nQuestion: {question}"}
        ]

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            max_tokens=2048,
        )

        reply = response.choices[0].message.content
        return {"reply": reply}

    except Exception as e:
        return {"error": str(e)}