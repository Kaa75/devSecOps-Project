output "detector_id" {
  description = "ID of the GuardDuty detector"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].id : null
}

output "event_rule_arn" {
  description = "ARN of the EventBridge rule for HIGH/CRITICAL GuardDuty findings"
  value       = var.enable_guardduty ? aws_cloudwatch_event_rule.guardduty_high_critical[0].arn : null
}
