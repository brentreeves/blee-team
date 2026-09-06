# Team Builder

This project is a single-page browser app that takes a CSV of member preferences and builds balanced teams without sending data anywhere. All logic runs locally in the browser.

## Purpose

The page helps users:
- paste a list of people and their ranked preferences
- assign point weights to each choice position
- set team-size and fairness constraints
- run a local optimization search to form teams with high overall happiness
- review team scores, member scores, summary limits, and a plain-text roster

## Core functionality

### Input format
The CSV is structured as:

```csv
name,first_choice,second_choice,third_choice,fourth_choice,fifth_choice,sixth_choice
```

Each row represents one person's team preference. The app parses the data, ignores blank rows, trims whitespace, and handles quoted fields safely.

### Preferences and scoring
The app converts each row into a preference map where each person scores points for teammates they prefer. The weights are configured in the UI as a comma-separated list like:

```text
13,8,5,3,2,1
```

These weights correspond to 1st choice through nth choice. A person who is not listed in the preference list for another member scores 0 for that match.

### Constraints
Users can configure:
- team size
- member cap (fairness cap relative to best score)
- team gap (maximum spread between the strongest and weakest team)
- seed for reproducible randomization
- exchanges per restart
- restarts for repeated optimization runs

The search supports both unconstrained and constrained optimization. If a limit is impossible to satisfy, the app reports that the limit was not met instead of silently producing a bad result.

### Optimization algorithm
The app uses a random-swap hill-climbing strategy:
- initialize random team assignments
- repeatedly swap two people between two teams
- keep improvements that increase overall happiness while balancing constraint penalties
- repeat across multiple restarts and keep the best arrangement found

This is implemented directly in the embedded JavaScript inside [blee-team.html](blee-team.html), and the algorithm is intentionally designed to optimize for both happiness and fairness constraints.

## Project structure

- [blee-team.html](blee-team.html): the complete app, including styles, markup, embedded algorithm, sample data, and UI logic
- [tests/verify.mjs](tests/verify.mjs): verification script that extracts the algorithm from the HTML and checks it against known optimum results
- [README.md](README.md): project documentation and usage notes

## How to use it

1. Open [blee-team.html](blee-team.html) in a browser.
2. Paste a CSV of preferences or click “Load sample class”.
3. Adjust weights and constraints.
4. Press “Build teams”.
5. Review:
   - team score breakdowns
   - per-person scores
   - summary limits and whether they hold
   - a roster export

## Verification

This project includes a Node-based verification script:

```bash
node tests/verify.mjs
```

It verifies the algorithm embedded in [blee-team.html](blee-team.html) against sample optimal totals and ensures the optimization logic matches expected behavior.

## Notes for future Claude sessions

- Do not assume this is a server-rendered or framework-based app; it is a static HTML page with embedded JavaScript.
- The business logic is inside the script labeled “ALGORITHM START” in [blee-team.html](blee-team.html).
- If you edit the optimization logic, validate with the same verification script before claiming it works.
- UI behavior is a thin wrapper around the algorithm: input validation, progress display, rendering, and clipboard copy happen in the page-level script at the end of the file.
- The app intentionally keeps all work local in the browser and does not upload data.
