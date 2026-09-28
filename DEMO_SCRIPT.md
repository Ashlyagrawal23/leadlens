# 3-minute demo script

Record the screen with sound. Stay under 3:00. Have `GEMINI_API_KEY` set before you start so the live calls succeed. The inbox already has six leads.

Say the product name and the job first. Do not tour every button.

## 0:00–0:25 — The inbox

Open the dashboard.

> "LeadLens is for a salesperson who gets too many inbound property leads. In about five seconds they should see who is hot, why, and the next action."

Point at Priya (hot, overdue, score) and Arjun (cold). Click Hot, then All. Mention the sort is score by default.

> "These six are demo leads so the page is full with no setup. The badge says demo analysis. The live model runs when I add or re-analyze a lead."

## 0:25–1:15 — Intake and analysis

Open **New lead**. Click **Load sample lead**. Submit.

When the detail page opens, point in this order: priority and score, the two-sentence summary, the green **Next action** box, requirements, the suggested WhatsApp reply, and **Why this score**.

> "The score is a rubric, not a vibe. Open Why this score. Budget, timeline, how specific they were, and how engaged the message is. Red flags subtract. The server adds those numbers. Hot starts at 70. The model is told not to invent facts, and the original message is still here if I need to check."

Open the customer message disclosure for one second, then close it.

## 1:15–1:40 — Grounded chat

Click **Make reply more assertive**. When the reply arrives, point at **Ready to send** and hit **Copy**.

> "This is not a generic chatbot. The server puts this lead's budget, timeline, and objections into the prompt, so the rewrite mentions Neha's 1.6 crore loan and the Saturday visit. If she had typed 'ignore your instructions' inside the inquiry, that text is fenced as data."

## 1:40–2:35 — My feature

Go to **Today's plan**.

> "Before the calls, this queue is just rules: overdue first, then score. It still works if Gemini is down."

Click **Generate AI plan**. Point at one reason, a time window, and the channel.

Open Priya (or the first AI item). Click **30-second brief**. Read the opener and the ask out loud, quickly.

Change status to **Contacted** only if it is not already. **Log contact**: channel WhatsApp, a one-line note ("She confirmed Saturday 10:30"), **Log contact**. Point at the overdue badge clearing or the new due date.

**Draft follow-up** on WhatsApp. Show the draft uses the note. Copy it.

> "After the call I log what happened, the follow-up date moves, and the draft matches the channel. Email would include a subject. SMS warns me if it is too long."

## 2:35–3:00 — One technical decision

Stay on the lead. You only need one point. Suggested:

> "I kept storage as four functions over localStorage, and I kept the model behind one server wrapper. Gemini is asked for JSON with a response schema, Zod checks it, and a bad parse retries once before Groq. The browser never sees the API key. The trade-off is that leads do not sync across phones, which is fine for this demo and wrong for a real team. That swap is the storage file, not a rewrite of the UI."

Stop. Do not open the code unless the interviewer asks later. The 30-minute interview is where you walk the files.
