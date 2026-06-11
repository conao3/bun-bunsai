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
    sns      = "http://localhost:${var.bunsai_port}"
    iam      = "http://localhost:${var.bunsai_port}"
    dynamodb = "http://localhost:${var.bunsai_port}"
  }
}

resource "aws_sqs_queue" "smoke" {
  name = "tf-smoke-queue"
}

resource "aws_sns_topic" "smoke" {
  name = "tf-smoke-topic"
}

resource "aws_sns_topic_subscription" "smoke_sqs" {
  topic_arn = aws_sns_topic.smoke.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.smoke.arn
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
