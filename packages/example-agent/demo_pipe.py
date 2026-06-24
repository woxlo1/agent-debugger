#!/usr/bin/env python3
"""
Demo: send an agent trace to Agent Debugger from Python — no SDK needed.

Agent Debugger only ships a TypeScript SDK, but the `agent-debugger pipe`
command accepts JSON Lines (one JSON object per line) from stdin, so any
language can send traces. This script just prints JSON Lines; pipe it in:

    python3 demo_pipe.py | agent-debugger pipe

Or, equivalently, write the lines to a file and read it back:

    python3 demo_pipe.py > trace.jsonl
    agent-debugger pipe trace.jsonl
"""
import json
import sys


def emit(event: dict) -> None:
    print(json.dumps(event), flush=True)


def main() -> None:
    emit({
        "type": "user",
        "name": "user_input",
        "input": "Summarize the latest sales report and flag any anomalies.",
    })
    emit({
        "type": "reasoning",
        "name": "plan",
        "output": "I'll fetch the sales report, then run anomaly detection on it.",
        "tokens": 35,
    })
    emit({
        "type": "tool",
        "name": "fetch_sales_report",
        "input": {"period": "last_30_days"},
        "output": {"rows": 142, "totalRevenue": 58210.50},
    })
    emit({
        "type": "tool",
        "name": "detect_anomalies",
        "input": {"rows": 142},
        "output": {"anomalies": [{"date": "2026-06-18", "reason": "revenue spike +320%"}]},
    })
    emit({
        "type": "agent",
        "name": "final_answer",
        "output": "Sales totaled $58,210.50 over 30 days. One anomaly found: a +320% revenue spike on 2026-06-18, worth investigating.",
        "tokens": 41,
        "cost": 0.0012,
    })


if __name__ == "__main__":
    main()
