# Learnings Index (generated — do not edit by hand)

One line per learning: `path | tier | phase | hook`. The hook is the precondition
question when the learning has one, else its title. This index is a **pointer, not
the lesson** — never cite or apply a learning from its index line alone; read the body.

Regenerate with `node scripts/generate-learnings-index.mjs` after adding a learning.
If you add a learning where you cannot run node (e.g. an installed skill copy),
append the line by hand in the same format.

Total: 5

- common-mistakes/agent-can-run-unity-compile-gates-headlessly.md | generalizable | p1,3,5,6 | Is a matching Unity Editor installed on this machine, with shell access, and the project NOT currently open in the Editor (no Temp/UnityLockfile)? (Applies to EVERY compile gate, not just phase 1.)
- common-mistakes/headless-smoke-test-instead-of-editor-init.md | generalizable | p1 | Can the agent launch Unity itself (Editor installed locally, project not locked), so the phase-1 Initialize() smoke test can run headlessly instead of as a hand-clicked Editor action?
- common-mistakes/investigate-before-asking.md | universal | p1,2,3,4,5,6,7,8 | Do the work before you speak — never ask what the repo answers, never assert what you haven't checked
- engine-quirks/headless-editor-setup-needs-executemethod.md | generalizable | p1 | Is the Ludeo package being installed or configured headlessly (-batchmode, CI, or an agent driving Unity), rather than by a human in an interactive Editor session?
- engine-quirks/sdk-setup-needs-two-headless-runs.md | generalizable | p1 | Is LudeoUnityEditorHelpers.SetupLudeoAssets being run headlessly for the FIRST time, i.e. before LudeoSettings.asset exists on disk?
