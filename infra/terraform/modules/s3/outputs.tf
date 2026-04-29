output "bucket_id" {
  description = "ID (name) of the invoice S3 bucket"
  value       = aws_s3_bucket.invoices.id
}

output "bucket_arn" {
  description = "ARN of the invoice S3 bucket"
  value       = aws_s3_bucket.invoices.arn
}
