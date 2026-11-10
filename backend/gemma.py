from __future__ import annotations

import json
import os
from typing import Any


MODEL_NAME = "gemma-4-26b-a4b-it"
SYSTEM_INSTRUCTION = """You are POLARIX's evidence-grounded astronomy assistant. Discuss the supplied real TIC, sector, ML, catalog, and photometry records. A candidate is not a confirmed discovery. Never invent measurements, catalog matches, uncertainty, or tool results. If a datum is absent, say it is unavailable. State which actual approved tool results support each numerical claim and distinguish model-generated interpretation from measured evidence. Explain uncertainty and plausible alternatives. You may request only the declared POLARIX Python tools; their returned values are authoritative for calculations."""

TOOL_DECLARATIONS = [
    {"name": "get_candidate_evidence", "description": "Read the real candidate, ML scores, feature row, catalog fields, BLS result, and detection rows for a candidate identifier.", "parameters": {"type": "OBJECT", "properties": {"candidate_id": {"type": "STRING"}}, "required": ["candidate_id"]}},
    {"name": "summarize_quality_flags", "description": "Calculate cadence and quality-mask counts from a local processed TESS NPZ.", "parameters": {"type": "OBJECT", "properties": {"tic_id": {"type": "STRING"}, "sector": {"type": "INTEGER"}}, "required": ["tic_id", "sector"]}},
    {"name": "compare_sap_pdcsap", "description": "Calculate descriptive comparison statistics from normalized SAP and PDCSAP arrays.", "parameters": {"type": "OBJECT", "properties": {"tic_id": {"type": "STRING"}, "sector": {"type": "INTEGER"}}, "required": ["tic_id", "sector"]}},
    {"name": "fold_periodic_signal", "description": "Fold real normalized PDCSAP observations on a supplied period and BTJD epoch.", "parameters": {"type": "OBJECT", "properties": {"tic_id": {"type": "STRING"}, "sector": {"type": "INTEGER"}, "period_days": {"type": "NUMBER"}, "epoch_btjd": {"type": "NUMBER"}}, "required": ["tic_id", "sector", "period_days", "epoch_btjd"]}},
    {"name": "verify_candidate", "description": "Return recorded scientific verification rows plus calculated quality and SAP/PDCSAP comparisons. This tool reports evidence; it does not classify a candidate as a discovery.", "parameters": {"type": "OBJECT", "properties": {"tic_id": {"type": "STRING"}, "sector": {"type": "INTEGER"}}, "required": ["tic_id", "sector"]}},
    {"name": "get_catalog_context", "description": "Read available Gaia DR3, SIMBAD, known-object, and TESS eclipsing-binary fields for a TIC.", "parameters": {"type": "OBJECT", "properties": {"tic_id": {"type": "STRING"}}, "required": ["tic_id"]}},
]


def api_key_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def call_model(prompt: str, history: list[dict[str, Any]], execute_tool, force_tool: str | None = None) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError("google-genai is not installed") from exc

    client = genai.Client(api_key=api_key)
    declarations = types.Tool(function_declarations=TOOL_DECLARATIONS)
    config_kwargs: dict[str, Any] = {
        "system_instruction": SYSTEM_INSTRUCTION,
        "tools": [declarations],
        "temperature": 0.2,
    }
    if force_tool:
        config_kwargs["tool_config"] = types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode="ANY", allowed_function_names=[force_tool]
            )
        )
    config = types.GenerateContentConfig(**config_kwargs)
    contents: list[Any] = []
    for turn in history[-12:]:
        role = "model" if turn.get("role") == "assistant" else "user"
        text = str(turn.get("content") or "")
        if text:
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=prompt)]))

    tool_calls: list[dict[str, Any]] = []
    for turn_index in range(4):
        try:
            response = client.models.generate_content(model=MODEL_NAME, contents=contents, config=config)
        except Exception as exc:
            if not tool_calls:
                raise
            returned = "\n".join(
                f"{call['name']}: {json.dumps(call['result'], ensure_ascii=False, allow_nan=False)}"
                for call in tool_calls
            )
            return {
                "text": (
                    "Gemma requested and received the following approved Python calculation, but its "
                    f"follow-up explanation could not be retrieved ({type(exc).__name__}). "
                    "The calculation is shown as evidence; no model interpretation is provided.\n\n"
                    + returned
                ),
                "tool_calls": tool_calls,
                "model": MODEL_NAME,
            }
        calls = response.function_calls or []
        if not calls:
            return {"text": response.text or "The model returned no text.", "tool_calls": tool_calls, "model": MODEL_NAME}
        model_content = response.candidates[0].content
        contents.append(model_content)
        for call in calls:
            arguments = dict(call.args or {})
            try:
                result = execute_tool(call.name, arguments)
                tool_calls.append({"name": call.name, "arguments": arguments, "result": result})
            except Exception as exc:  # Feed bounded tool errors back to the model without exposing internals.
                result = {"error": f"Approved tool failed: {type(exc).__name__}"}
                tool_calls.append({"name": call.name, "arguments": arguments, "result": result})
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_function_response(name=call.name, response=result, id=call.id)],
            ))
        # ANY mode is only used to guarantee the first call in the live smoke test.
        # Keep the following turn in AUTO so Gemma can explain its actual result.
        if force_tool and turn_index == 0:
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[declarations],
                temperature=0.2,
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="AUTO")
                ),
            )
    raise RuntimeError("Gemma exceeded the approved tool-call limit")
