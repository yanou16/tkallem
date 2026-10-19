## What changed, and why


## What does it touch?

- [ ] Web screens (`apps/web`)
- [ ] API routes, database or migrations (`apps/api`)
- [ ] The coach, prompts or scenarios (`packages/agent`)
- [ ] Docs, CI or settings only

## Before you ask for a review

- [ ] My branch is up to date with `main`. I did not merge or "sync" an old branch, and I did not revert someone else's pull request without asking.
- [ ] `git diff --stat main` shows what I expect: no files deleted that I did not create.
- [ ] Tests pass locally (the pre-push hook runs them). If the coach changed, the AI gate is green.
- [ ] I opened the Vercel preview and tried the main path: first question, a correction, "Say it again", the report.

`main` needs an approval from the project lead. The competition is in feature freeze: fixes only, no new features unless agreed first.
