---
name: add-env-var
description: Add an environment variable (secret or setting) that a sujstack app or worker reads, everywhere it must be declared - composition root, .env.example and Terraform. Use when code needs a new secret, API key or URL.
---

Secrets come from the environment; topology and behaviour come from code. If the value is not a
secret or a per-deployment URL, make it a constant in code instead.

1. **Read it in a composition root only** (`packages/server/src/**/runtime.ts`, `server/obs.ts`,
   `apps/worker/src/index.ts`), and pass it down as data. Nothing else touches `process.env`. Decide
   what happens when it is unset: a development default, or an inert or `503` feature in production.
2. **Document it in `.env.example`**: which file reads it, what it is for, and what happens unset.
3. **Declare it in Terraform**, or it never reaches a deployment:
   - A secret supplied by a person: a `variable` in `infra/variables.tf` with `sensitive = true` and
     `default = null`, set in the gitignored `infra/terraform.tfvars`.
   - A secret Terraform can generate: a `random_password` resource.
   - For the Next app, add it to `local.environment_variables` in `infra/vercel.tf` (optional ones
     go in `optional_variables`, which skips nulls). For the worker, add it to `local.worker_env` in
     `infra/render.tf`.
4. `bun run infra:check`. The next `terraform -chdir=infra apply` sets the variable and redeploys
   `main`.
