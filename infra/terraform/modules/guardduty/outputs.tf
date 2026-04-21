output "detector_id" {
  description = "ID of the GuardDuty detector"
  value       = aws_guardduty_detector.main.id
}

output "event_rule_arn" {
  description = "ARN of the EventBridge rule for HIGH/CRITICAL GuardDuty findings"
  value       = aws_cloudwatch_event_rule.guardduty_high_critical.arn
}
