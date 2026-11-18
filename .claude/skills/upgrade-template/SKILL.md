---
name: upgrade-template
description: Upgrade an app made from the sujstack template to a newer template release (merge a template/vX.Y.Z tag). Use when asked to upgrade, update or sync with the template, or to take a template fix.
---

Follow *Upgrading to a newer template release* in `AGENTS.md`, step by step. The points most often
got wrong:

- Merge a release tag (`template/vX.Y.Z`), never `template/main`.
- Read the *Upgrade notes* of every release between the current version (`bun pm pkg get version`)
  and the target before merging, with `git show template/vX.Y.Z:CHANGELOG.md`, and apply their
  manual steps.
- A modify/delete conflict on a file of a feature listed under `removed` in `sujstack.json` stays
  deleted (`git rm`).
- Run `git submodule update --init` and `bun install` after the merge: the release may pin a newer kit.
- Work on a branch and open a pull request, so the Terraform plan is reviewed before it applies.
