# Per-Phase Reference Template

Every `references/*.md` file in every skill uses these sections, in this order. This keeps all skills
reading and behaving alike. Engine-specific instructions live inside the **Steps** section; everything
else is structural.

```markdown
# Phase NN — <Name>

## 1. Goal / Purpose
What this phase produces, in one paragraph. Concrete deliverable.

## 2. Inputs (Input Contract)
Required artifacts from prior phases + a pre-flight checklist ([ ] items).

## 3. Steps
Numbered, ordered work. Map/plan sub-steps (Na) then implement sub-steps (Nb).
Engine-specific instructions live here.

## 4. Questions to ask the human
Only decisions that cannot be inferred from code.

## 5. Patterns to apply
Reusable patterns / reference architecture for this phase.

## 6. Output Contract
Exact artifacts produced (files, state-file keys, TDD sections).

## 7. Success Criteria
A checklist the agent MUST satisfy before marking the phase complete.
This is the gate — compile / runtime / human-confirmation requirements go here.

## 8. Common Mistakes
What prior integrations got wrong at this phase (link to learnings/).
```

The two sections that most improve consistency are a uniform **Output Contract** and an explicit
**Success Criteria** checklist on every phase. Do not omit them.
