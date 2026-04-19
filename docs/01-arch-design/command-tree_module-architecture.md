```mermaid
flowchart TD
    U[User / Issue / Task Prompt] --> CLI[Mannostree CLI]

    subgraph Command_Layer["Mannostree Command Layer"]
        CLI --> S1["spawn <name> -b <base>"]
        CLI --> S2["parallel spawn <feature> <N> -b <base>"]
        CLI --> S3["parallel run <feature> <N> -b <base> --plan <file>"]
        CLI --> S4["parallel compare <feature>"]
        CLI --> S5["parallel pick <feature> <variant>"]
        CLI --> S6["pr create / parallel pr create"]
        CLI --> S7["drop / parallel drop"]
    end

    subgraph Orchestration_Layer["Workspace / Branch Orchestration"]
        O1[Resolve task]
        O2[Select base branch]
        O3[Generate branch naming]
        O4[Create worktree metadata]
        O5[Create .task artifact pack]
        O6[Track winner / publish state]
    end

    S1 --> O1
    S2 --> O1
    S3 --> O1

    O1 --> O2 --> O3 --> O4 --> O5

    subgraph Single_Path["Single-Branch Execution"]
        B1["Branch: feature/<name>"]
        W1["Worktree: .worktrees/<name>"]
        P1[Planner]
        I1[Worker]
        V1[Verifier]
        R1[Reviewer]
        G1{Critical issues?}
    end

    O5 --> B1 --> W1 --> P1 --> I1 --> V1 --> R1 --> G1
    G1 -->|Yes| I1
    G1 -->|No| PUB1[Publish Candidate]

    subgraph Parallel_Path["Parallel Variant Execution"]
        PB["Branches: experiment/<feature>-v1..vN"]
        PW["Worktrees: .worktrees/<feature>-v1..vN"]
        CP[Common Plan or Variant Plans]

        Wv1[Worker v1]
        Wv2[Worker v2]
        WvN[Worker vN]

        Vv1[Verifier v1]
        Vv2[Verifier v2]
        VvN[Verifier vN]

        Rv1[Reviewer v1]
        Rv2[Reviewer v2]
        RvN[Reviewer vN]

        C1[Comparator / Variant Judge]
        C2[Winner Selection]
    end

    O5 --> PB --> PW --> CP
    CP --> Wv1 --> Vv1 --> Rv1 --> C1
    CP --> Wv2 --> Vv2 --> Rv2 --> C1
    CP --> WvN --> VvN --> RvN --> C1
    S4 --> C1
    C1 --> C2
    S5 --> C2
    C2 --> PUB2[Winning Variant Ready]

    subgraph Artifact_Store["Per-Worktree Artifact Store"]
        A1[".task/task-contract.md"]
        A2[".task/solution-options.md"]
        A3[".task/implementation-plan.md"]
        A4["RESULTS.md"]
        A5[".task/quality-gates.md"]
        A6[".task/review.md"]
        A7[".task/comparison.md"]
        A8[".task/pr-body.md"]
    end

    O1 -.writes.-> A1
    O1 -.may write.-> A2
    P1 -.writes.-> A3
    I1 -.writes.-> A4
    V1 -.writes.-> A5
    R1 -.writes.-> A6

    CP -.writes/uses.-> A3
    Wv1 -.writes.-> A4
    Wv2 -.writes.-> A4
    WvN -.writes.-> A4
    Vv1 -.writes.-> A5
    Vv2 -.writes.-> A5
    VvN -.writes.-> A5
    Rv1 -.writes.-> A6
    Rv2 -.writes.-> A6
    RvN -.writes.-> A6
    C1 -.writes.-> A7

    PUB1 --> S6
    PUB2 --> S6
    S6 --> A8
    S6 --> GH[GitHub PR / Review Flow]

    GH --> KEEP[Keep worktree alive]
    KEEP --> S7
```

### Key rule

**Branch and worktree lifecycle belong to Mannostree + the Branch-Orchestrator layer, not to the Worker agents.**

### Clean role split

* **CLI**: entrypoint and command UX
* **Orchestration layer**: base branch, naming, metadata, artifact pack
* **Agents**: plan, implement, verify, review, compare
* **Artifact store**: durable handoff/state per worktree
* **GitHub layer**: publish only after selection/review

### Best command story

* Single path: `spawn -> plan -> implement -> verify -> review -> pr create`
* Parallel path: `parallel spawn/run -> compare -> pick -> parallel pr create`

If you want, next I can turn this into a **command tree + module architecture diagram**.
