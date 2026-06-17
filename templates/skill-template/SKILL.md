---
name: {{SKILL_NAME}}
description: REPLACE ME — one or two sentences describing exactly when an agent should trigger this skill. Be specific and trigger-oriented; this is what the agent matches on.
metadata:
  version: 0.1.0
---

# {{SKILL_NAME}}

## Overview

One paragraph: what this skill does and the outcome it produces.

## When to use

- "…"
- "…"

If <preconditions not met>, stop and point the user at the right skill.

## Ground rules

REPLACE ME — list any repo-wide rules the agent must read before editing the user's project.

## Workflow

This skill walks the integration phases. Each phase has a reference file under `references/`.

| Phase | Reference |
| --- | --- |
| 0 — Setup & Install | `references/phase-00-setup.md` |
| … | … |

## State & resume

Integration state lives in the user's project at `.ludeo/integration.json`. On each session, detect the
current phase and resume there. Do one phase per session unless the user asks otherwise.
