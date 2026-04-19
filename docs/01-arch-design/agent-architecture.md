```mermaid
flowchart TD
    U[User / GitHub Issue / Task Prompt] --> A[Task-Resolver Agent]
    A --> B[Brainstorm / Solution-Explorer Agent]

    B --> C{Single path or parallel variants?}

    C -->|Single path| D[Branch-Orchestrator Agent]
    C -->|Parallel variants| E[Parallel Branch-Orchestrator Agent]

    D --> D1[Create dedicated branch]
    D1 --> D2[Create isolated worktree]
    D2 --> P[Planner Agent]
    P --> W[Worker / Implementer Agent]
    W --> V[Verifier Agent]
    V --> R[Reviewer Agent]
    R --> RC{Critical issues?}
    RC -->|Yes| W
    RC -->|No| PR[PR / Publish Agent]
    PR --> Z[Open PR / Ready for Review]

    E --> E1[Create N dedicated branches]
    E1 --> E2[Create N isolated worktrees]
    E2 --> P2[Common Plan or Variant-Specific Plans]

    P2 --> W1[Worker v1]
    P2 --> W2[Worker v2]
    P2 --> W3[Worker vN]

    W1 --> V1[Verifier v1]
    W2 --> V2[Verifier v2]
    W3 --> V3[Verifier vN]

    V1 --> R1[Reviewer v1]
    V2 --> R2[Reviewer v2]
    V3 --> R3[Reviewer vN]

    R1 --> CMP[Comparator / Variant-Judge Agent]
    R2 --> CMP
    R3 --> CMP

    CMP --> PICK[Winner Selection]
    PICK --> PR2[PR / Publish Agent]
    PR2 --> Z2[Open PR for Winning Variant]

    subgraph Shared Artifacts
        T1[task-contract.md]
        T2[solution-options.md]
        T3[implementation-plan.md]
        T4[RESULTS.md]
        T5[quality-gates.md]
        T6[review.md]
        T7[comparison.md]
        T8[pr-body.md]
    end

    A -.writes.-> T1
    B -.writes.-> T2
    P -.writes.-> T3
    W -.writes.-> T4
    V -.writes.-> T5
    R -.writes.-> T6
    CMP -.writes.-> T7
    PR -.writes.-> T8
    PR2 -.writes.-> T8
```

## Role summary

* **Task-Resolver**: turns issue/prompt into a normalized task contract
* **Brainstorm / Solution-Explorer**: decides whether one branch is enough or multiple variants are worth testing
* **Branch-Orchestrator**: owns branch naming, base branch selection, worktree creation, metadata
* **Planner**: produces the implementation plan for a given branch/worktree
* **Worker**: implements and writes `RESULTS.md`
* **Verifier**: runs lint/test/build and writes `quality-gates.md`
* **Reviewer**: checks correctness, scope fit, maintainability, risk
* **Comparator / Variant-Judge**: compares v1..vN and recommends the winner
* **PR / Publish Agent**: prepares PR body and publishes the selected branch

## Core design rule

**Branch lifecycle belongs to the Branch-Orchestrator, not to the Worker.**

## Suggested branch model

* Single implementation:

  * `feature/<name>`
  * `fix/<name>`
  * `refactor/<name>`

* Parallel experiment:

  * `experiment/<feature>-v1`
  * `experiment/<feature>-v2`
  * `experiment/<feature>-v3`

Ha akarod, megcsinálom ennek a **cleaner v2 diagramját** kifejezetten `mannostree` command layerrel együtt.
