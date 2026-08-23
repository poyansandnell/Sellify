---
name: GitHub connector Git Data
description: Reliable repository pushes when ordinary Git credentials are unavailable and GitHub Git-object responses break durable replay.
---

Use a fresh isolated connector subagent for Git Data API pushes if the main durable JavaScript session repeatedly fails while replaying nullable Git-object metadata. Require a non-force ref update from the expected parent, then compare the remote and local tree hashes before moving the local branch to the connector-created commit.

**Why:** GitHub's authenticated connector can create the correct tree and commit while the main durable runtime rejects nullable response metadata during replay. Retrying the same long-lived runtime does not repair that serialization failure and risks losing clarity about whether a remote write happened.

**How to apply:** First query the remote ref after any failed attempt. Delegate the complete tree/commit/ref operation to a fresh connector session, forbid force updates, and verify remote tree equality before resetting or fast-forwarding local refs.
