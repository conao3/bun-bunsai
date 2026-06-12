variable "bunsai_port" {
  type    = number
  default = 4566
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  access_key                  = "test"
  secret_key                  = "test"
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    sqs      = "http://localhost:${var.bunsai_port}"
    iam      = "http://localhost:${var.bunsai_port}"
    dynamodb = "http://localhost:${var.bunsai_port}"
    s3       = "http://localhost:${var.bunsai_port}"
    sns      = "http://localhost:${var.bunsai_port}"
    lambda   = "http://localhost:${var.bunsai_port}"
    logs     = "http://localhost:${var.bunsai_port}"
    events   = "http://localhost:${var.bunsai_port}"
    sts      = "http://localhost:${var.bunsai_port}"
  }
}

resource "aws_sqs_queue" "smoke" {
  name = "tf-smoke-queue"
}

resource "aws_iam_role" "smoke" {
  name = "tf-smoke-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_dynamodb_table" "smoke" {
  name         = "tf-smoke-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }
}

resource "aws_s3_bucket" "smoke" {
  bucket = "tf-smoke-bucket"
}

resource "aws_s3_bucket_versioning" "smoke" {
  bucket = aws_s3_bucket.smoke.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_sns_topic" "smoke" {
  name = "tf-smoke-topic"
}

resource "aws_sns_topic_subscription" "smoke" {
  topic_arn = aws_sns_topic.smoke.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.smoke.arn
}

resource "aws_cloudwatch_log_group" "smoke" {
  name              = "/aws/lambda/tf-smoke-fn"
  retention_in_days = 7
}

resource "aws_iam_role_policy" "smoke" {
  name = "tf-smoke-policy"
  role = aws_iam_role.smoke.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.smoke.arn
      }
    ]
  })
}

resource "aws_lambda_function" "smoke" {
  function_name = "tf-smoke-fn"
  filename      = "${path.module}/fn.zip"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.smoke.arn
  depends_on    = [aws_cloudwatch_log_group.smoke]
}

resource "aws_cloudwatch_event_rule" "smoke" {
  name        = "tf-smoke-rule"
  description = "smoke test rule"
  event_pattern = jsonencode({
    source      = ["smoke.test"]
    detail-type = ["SmokeTest"]
  })
}

resource "aws_cloudwatch_event_target" "smoke" {
  rule = aws_cloudwatch_event_rule.smoke.name
  arn  = aws_sqs_queue.smoke.arn
}
