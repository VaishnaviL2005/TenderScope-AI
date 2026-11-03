"""Neon Object Storage adapter (S3-compatible, path-style requests required)."""
import os
import boto3
from botocore.config import Config
from app.config import settings

def _client():
    required=("AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_ENDPOINT_URL_S3","AWS_REGION")
    missing=[key for key in required if not os.getenv(key)]
    if missing: raise RuntimeError("Neon Object Storage is not configured: missing " + ", ".join(missing))
    return boto3.client("s3",endpoint_url=os.environ["AWS_ENDPOINT_URL_S3"],region_name=os.environ["AWS_REGION"],config=Config(s3={"addressing_style":"path"}))
def put_bytes(key, body, content_type):
    _client().put_object(Bucket=settings.storage_bucket,Key=key,Body=body,ContentType=content_type)
    return key
def status():
    _client().head_bucket(Bucket=settings.storage_bucket)
    return {"backend":"neon_s3","bucket":settings.storage_bucket,"ready":True}
