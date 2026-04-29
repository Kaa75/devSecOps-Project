output "web_acl_arn" {
  description = "ARN of the WAF v2 WebACL"
  value       = aws_wafv2_web_acl.this.arn
}

output "web_acl_id" {
  description = "ID of the WAF v2 WebACL"
  value       = aws_wafv2_web_acl.this.id
}
