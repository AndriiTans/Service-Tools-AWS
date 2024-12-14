# ServiceToolAWS

This repository contains a set of AWS Lambda functions that work together to handle file uploads, parsing, and content delivery. The system includes the following Lambda functions:

## Lambda Functions Overview

- **Auth Lambda**: Handles authentication tasks.
- **Parser Lambda**: Processes uploaded HTML files to extract JSON data and save messages to the database.
- **Upload Lambda**: Generates pre-signed S3 bucket links for the frontend.
- **ContentDelivery Lambda**: Provides routes to retrieve data from the database.

## Workflow

### Upload Lambda:
- Generates pre-signed URLs for the S3 bucket and returns them to the frontend.
- The frontend uses these URLs to upload files directly to the S3 bucket.

### S3 Bucket:
- Uploaded files are stored in the `upload` folder.
- Upload events trigger an SQS queue with file metadata.

### SQS Queue:
- Processes file upload events and triggers the **Parser Lambda**.

### Parser Lambda:
- Parses the uploaded HTML files.
- Extracts the relevant JSON data.
- Separates and saves individual messages into the database.

### ContentDelivery Lambda:
- Provides API routes for retrieving the stored data from the database.

## AWS SDK Integration

- The project uses the AWS SDK to deploy each Lambda function with the appropriate IAM roles and permissions.
- Ensure the roles assigned to each Lambda function have the necessary permissions (e.g., S3, SQS, DynamoDB, etc.).

## System Architecture

### Frontend (FE):
- Requests pre-signed URLs from the Upload Lambda.
- Uploads files to the S3 bucket using the provided URLs.

### Backend:
- SQS Queue handles event-driven processing for uploaded files.
- Parser Lambda processes the files and interacts with the database.
- ContentDelivery Lambda exposes APIs for accessing the processed data.

## Key Features

- **Secure File Uploads**: Ensures files are uploaded securely using pre-signed URLs.
- **Event-Driven Parsing**: Utilizes SQS to trigger parsing workflows automatically.
- **Database Storage**: Saves parsed data efficiently for later retrieval.
- **Scalable Design**: Leverages AWS services for scalability and reliability.

## Future Improvements

- Add monitoring and logging for better debugging and system insights.
- Implement additional error handling and retries for edge cases.
- Optimize database queries in the ContentDelivery Lambda for faster response times.
- Add unit and integration tests for all Lambda functions.

## Prerequisites

- AWS account with access to S3, SQS, Lambda, and DynamoDB.
- AWS CLI configured with the required credentials.
- Node.js and npm installed locally for Lambda development.

## Deployment

- Use the AWS SDK or AWS SAM CLI to package and deploy the Lambda functions.
- Ensure each Lambda function is assigned the appropriate IAM role with the necessary permissions.

## Table of Contents
- [CloudFront](./docs/CloudFront.md)