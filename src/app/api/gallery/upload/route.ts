import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from '@/lib/r2';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      return NextResponse.json({ 
        error: 'Cloudflare R2 configuration is missing. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment variables.' 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;

    if (!file || !fileName) {
      return NextResponse.json({ error: 'Missing file or filename' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = fileName.split('.').pop();
    const key = `gallery/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(command);

    const publicUrl = `${R2_PUBLIC_DOMAIN}/${key}`;

    return NextResponse.json({ publicUrl, key });
  } catch (error: any) {
    console.error('Error uploading to R2:', error);
    return NextResponse.json({ error: error.message || 'Error uploading to Cloudflare R2' }, { status: 500 });
  }
}
