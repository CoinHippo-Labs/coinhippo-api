terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31"
    }
  }
  required_version = ">= 1.6.6"
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

provider "archive" {}

data "archive_file" "zip" {
  type        = "zip"
  source_dir  = "../"
  excludes    = ["terraform", ".gitignore", "README.md", "LICENSE", "yarn.lock"]
  output_path = "${var.package_name}.zip"
}

data "aws_iam_policy_document" "policy" {
  statement {
    sid     = ""
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["lambda.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "role" {
  name               = "${var.package_name}-role-lambda"
  assume_role_policy = data.aws_iam_policy_document.policy.json
}

resource "aws_iam_policy_attachment" "attachment" {
  name       = "${var.package_name}-attachment"
  roles      = [aws_iam_role.role.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_opensearch_domain" "domain" {
  domain_name    = "${var.package_name}"
  engine_version = "OpenSearch_2.11"
  cluster_config {
    instance_type            = "t3.small.search"
    instance_count           = 1
    dedicated_master_enabled = false
    zone_awareness_enabled   = false
    warm_enabled             = false
  }
  ebs_options {
    ebs_enabled = true
    volume_type = "gp2"
    volume_size = 10
  }
  encrypt_at_rest {
    enabled = true
  }
  node_to_node_encryption {
    enabled = true
  }
  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }
  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = var.indexer_username
      master_user_password = var.indexer_password
    }
  }
}

resource "aws_opensearch_domain_policy" "main" {
  domain_name = aws_opensearch_domain.domain.domain_name
  access_policies = <<POLICIES
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["es:*"],
      "Principal": {
        "AWS": ["*"]
      },
      "Effect": "Allow",
      "Resource": "${aws_opensearch_domain.domain.arn}/*"
    }
  ]
}
POLICIES
}

resource "aws_lambda_function" "function" {
  function_name    = "${var.package_name}"
  filename         = data.archive_file.zip.output_path
  source_code_hash = data.archive_file.zip.output_base64sha256
  role             = aws_iam_role.role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 256
  environment {
    variables = {
      NODE_NO_WARNINGS            = 1
      INDEXER_URL                 = "https://${aws_opensearch_domain.domain.endpoint}"
      INDEXER_USERNAME            = var.indexer_username
      INDEXER_PASSWORD            = var.indexer_password
      NEWS_KEY                    = var.news_key
      WHALE_ALERT_KEY             = var.whale_alert_key
      TWITTER_KEY                 = var.twitter_key
      TWITTER_SECRET              = var.twitter_secret
      TWITTER_ACCESS_TOKEN        = var.twitter_access_token
      TWITTER_ACCESS_TOKEN_SECRET = var.twitter_access_token_secret
      TELEGRAM_KEY                = var.telegram_key
      TELEGRAM_CHANNEL            = var.telegram_channel
    }
  }
  kms_key_arn      = ""
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.package_name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_headers = ["*"]
    allow_methods = ["*"]
  }
  route_key     = "ANY /${aws_lambda_function.function.function_name}"
  target        = aws_lambda_function.function.arn
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  connection_type        = "INTERNET"
  description            = "Lambda Integration - terraform"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.function.invoke_arn
  integration_type       = "AWS_PROXY"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_route" "route_method" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /{method}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "${var.package_name}-rule"
  schedule_expression = "cron(*/5 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "target" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = aws_lambda_function.function.id
  arn       = aws_lambda_function.function.arn
}