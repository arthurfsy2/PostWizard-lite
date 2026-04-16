'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Printer, ChevronLeft, LayoutGrid, LayoutTemplate } from 'lucide-react';

interface PrintContent {
  id: string;
  contentTitle: string;
  contentBody: string;
  recipientName: string;
  country: string;
  city: string;
  postcardId: string;
}

function BatchPrintPageContent() {
  const searchParams = useSearchParams();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const [contents, setContents] = useState<PrintContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'2x2' | '1x2'>('2x2');

  useEffect(() => {
    if (ids.length === 0) {
      setError('未选择要打印的内容');
      setLoading(false);
      return;
    }

    fetchContents();
  }, [ids.join(',')]);

  const fetchContents = async () => {
    try {
      const requests = ids.map(async (id) => {
        const response = await fetch(`/api/content/${id}`);
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.error || `获取内容失败: ${id}`);
        }

        const item = result.data;
        return {
          id: item.id,
          contentTitle: item.contentTitle || '未命名内容',
          contentBody: item.contentEn || item.contentBody || '',
          recipientName: item.postcard?.recipientName || 'Unknown',
          country: item.postcard?.recipientCountry || 'Unknown',
          city: item.postcard?.recipientCity || 'Unknown',
          postcardId: item.postcard?.postcardId || 'Unknown',
        };
      });

      const formatted = await Promise.all(requests);
      setContents(formatted);
    } catch (err: any) {
      setError(err?.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const itemsPerPage = layout === '2x2' ? 4 : 2;
  const pages = [];
  for (let i = 0; i < contents.length; i += itemsPerPage) {
    pages.push(contents.slice(i, i + itemsPerPage));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="print:hidden bg-muted border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-bold">批量打印</h1>
                <p className="text-sm text-muted-foreground">
                  共 {contents.length} 张明信片
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-background rounded-lg p-1 border">
                <button
                  onClick={() => setLayout('2x2')}
                  className={`p-2 rounded ${layout === '2x2' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  title="2x2 网格（每页4张）"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLayout('1x2')}
                  className={`p-2 rounded ${layout === '1x2' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  title="1x2 纵向（每页2张）"
                >
                  <LayoutTemplate className="h-4 w-4" />
                </button>
              </div>

              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 bg-white">
        {error && (
          <div className="container py-8 print:hidden">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center min-h-[400px] print:hidden">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        )}

        {!loading && !error && (
          <div className="print-container">
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className={`print-page ${layout === '2x2' ? 'grid-2x2' : 'grid-1x2'}`}
              >
                {page.map((item, index) => (
                  <div key={item.id} className="postcard-item">
                    {index > 0 && layout === '2x2' && (
                      <div className="cut-line-horizontal" />
                    )}
                    {index > 0 && layout === '1x2' && (
                      <div className="cut-line-vertical" />
                    )}

                    <div className="postcard-content">
                      <div className="postcard-header">
                        <div className="postcard-id">{item.postcardId}</div>
                        <div className="postcard-recipient">
                          To: {item.recipientName}
                        </div>
                        <div className="postcard-location">
                          {item.city}, {item.country}
                        </div>
                      </div>

                      <div className="postcard-body">
                        {item.contentBody}
                      </div>

                      <div className="postcard-footer">
                        <Badge variant="outline" className="text-xs">
                          {item.contentTitle}
                        </Badge>
                      </div>
                    </div>

                    <div className="page-indicator">
                      {pageIndex * itemsPerPage + index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            background: white;
          }

          .print-page {
            page-break-after: always;
            break-after: page;
          }

          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }

        .print-container {
          padding: 20px;
        }

        @media print {
          .print-container {
            padding: 0;
          }
        }

        .print-page {
          width: 210mm;
          min-height: 277mm;
          margin: 0 auto 20px;
          background: white;
          position: relative;
        }

        .grid-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0;
        }

        .grid-1x2 {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0;
        }

        .postcard-item {
          position: relative;
          padding: 15mm;
          border: 1px dashed #ccc;
          display: flex;
          flex-direction: column;
        }

        .grid-2x2 .postcard-item {
          min-height: 138mm;
        }

        .grid-1x2 .postcard-item {
          min-height: 138mm;
        }

        .cut-line-horizontal {
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 20mm;
          height: 2px;
          background: repeating-linear-gradient(
            to right,
            #000 0px,
            #000 2px,
            transparent 2px,
            transparent 5px
          );
        }

        .cut-line-vertical {
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 20mm;
          height: 2px;
          background: repeating-linear-gradient(
            to right,
            #000 0px,
            #000 2px,
            transparent 2px,
            transparent 5px
          );
        }

        .postcard-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .postcard-header {
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .postcard-id {
          font-size: 10px;
          color: #666;
          font-family: monospace;
        }

        .postcard-recipient {
          font-size: 14px;
          font-weight: 600;
          margin-top: 4px;
        }

        .postcard-location {
          font-size: 11px;
          color: #666;
        }

        .postcard-body {
          flex: 1;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: break-word;
        }

        .postcard-footer {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }

        .page-indicator {
          position: absolute;
          top: 5mm;
          right: 5mm;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #666;
        }

        @media print {
          .postcard-item {
            border: none;
          }

          .page-indicator {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
        <Footer />
      </div>
    }>
      <BatchPrintPageContent />
    </Suspense>
  );
}
