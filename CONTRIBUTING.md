# Contributing

Start with [AGENTS.md](AGENTS.md). Keep specifications and public interface changes
reviewable independently of code. Use a numbered directory under `specs/`.

1. Define the behavior and acceptance criteria in the feature specification.
2. Document the implementation boundaries and assign a task to each requirement.
3. Exercise the acceptance cases with deterministic fixture data.
4. Run `npm run check` and update the task status with the verified evidence.
5. Update the README for installation or behavior changes. Record end-user changes
   under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).

Example API contracts in this repository are synthetic. Use a minimal synthetic
reproduction when reporting a problem.
