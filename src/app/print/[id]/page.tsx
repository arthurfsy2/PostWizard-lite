"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PrintLayout from '@/components/PrintLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PrintPageData {
  id: string;
  content: string;
  recipientName: string;
  recipientCountry: string;
  senderCity?: string;
}

export default function PrintPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, token } = useAuth();
  const [postcard, setPostcard] = useState<PrintPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const postcardId = params.id as string;

  useEffect(() => {
    if (authLoading || !postcardId || !token) return;

    const fetchPostcard = async () => {
      try {
        const response = await fetch(`/api/content/${postcardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();

        if (response.ok && result?.success && result?.data) {
          const data = result.data;
          setPostcard({
            id: data.id,
            content: data.contentEn || data.contentBody || '',
            recipientName: data.postcard?.recipientName || 'Unknown',
            recipientCountry: data.postcard?.recipientCountry || 'Unknown',
            senderCity: 'Shenzhen',
          });
        } else {
          setError(result?.error || '明信片不存在');
        }
      } catch (err) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchPostcard();
  }, [authLoading, postcardId, token]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !postcard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || '明信片不存在'}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>

        <PrintLayout
          postcardId={postcard.id}
          content={postcard.content}
          recipientName={postcard.recipientName}
          recipientCountry={postcard.recipientCountry}
          senderCity={postcard.senderCity}
        />
      </div>
    </div>
  );
}

