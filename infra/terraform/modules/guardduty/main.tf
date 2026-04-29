data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ─── GuardDuty Detector ───────────────────────────────────────────────────────
# Disabled - requires AWS subscription
# Uncomment after subscribing to GuardDuty

resource "aws_guardduty_detector" "main" {
  count  = var.enable_guardduty ? 1 : 0
  enable = false  # Disabled - subscription required

  datasources {
    s3_logs {
      enable = false
    }
    kubernetes {
      audit_logs {
        enable = false
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = false
        }
      }
    }
  }

  tags = {
    Name        = "${var.project}-${var.environment}-guardduty"
    Environment = var.environment
    Project     = var.project
    Owner       = var.owner
  }
}

# ─── EventBridge Rule — HIGH / CRITICAL findings (severity >= 7) ─────────────

resource "aws_cloudwatch_event_rule" "guardduty_high_critical" {
  count       = var.enable_guardduty ? 1 : 0
  name        = "${var.project}-${var.environment}-guardduty-high-critical"
  description = "Triggers on GuardDuty findings with severity HIGH (7-8.9) or CRITICAL (9-10)"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    "detail-type" = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })

  tags = {
    Environment = var.environment
    Project     = var.project
    Owner       = var.owner
  }
}

# ─── EventBridge Target → SNS ─────────────────────────────────────────────────

resource "aws_cloudwatch_event_target" "guardduty_sns" {
  count     = var.enable_guardduty ? 1 : 0
  rule      = aws_cloudwatch_event_rule.guardduty_high_critical[0].name
  target_id = "GuardDutySNSTarget"
  arn       = var.sns_topic_arn
}

# ─── SNS Topic Policy — allow EventBridge to publish ─────────────────────────

data "aws_iam_policy_document" "sns_eventbridge_publish" {
  count = var.enable_guardduty ? 1 : 0
  statement {
    sid    = "AllowEventBridgePublish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sns:Publish"]
    resources = [var.sns_topic_arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.guardduty_high_critical[0].arn]
    }
  }
}

resource "aws_sns_topic_policy" "guardduty_eventbridge" {
  count  = var.enable_guardduty ? 1 : 0
  arn    = var.sns_topic_arn
  policy = data.aws_iam_policy_document.sns_eventbridge_publish[0].json
}
