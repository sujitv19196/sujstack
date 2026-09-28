output "vercel_project_id" {
  value = vercel_project.app.id
}

output "neon_project_id" {
  value = neon_project.app.id
}

output "neon_preview_branch_id" {
  value = neon_branch.preview.id
}

output "worker_health_url" {
  value = "https://${railway_service_domain.worker.domain}/health"
}
