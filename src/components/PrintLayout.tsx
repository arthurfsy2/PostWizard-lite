"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PrintLayoutProps {
  postcardId: string;
  content: string;
  recipientName: string;
  recipientCountry: string;
  senderCity?: string;
  onHandwrittenPreference?: (prefer: boolean) => void;
}

export default function PrintLayout({
  postcardId,
  content,
  recipientName,
  recipientCountry,
  senderCity = 'Shenzhen',
  onHandwrittenPreference,
}: PrintLayoutProps) {
  const [preferHandwritten, setPreferHandwritten] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentIds: [postcardId],
          format: 'a4',
        }),
      });

      const result = await response.json();
      if (response.ok && result?.success && result?.pdf) {
        const a = document.createElement('a');
        a.href = result.pdf;
        a.download = `postcard-${postcardId}.pdf`;
        a.click();
      }
    } catch (error) {
      // console.error('Failed to download PDF:', error);
    }
  };


  const toggleHandwritten = () => {
    const newValue = !preferHandwritten;
    setPreferHandwritten(newValue);
    onHandwrittenPreference?.(newValue);
  };

  return (
    <div className="print-layout">
      {/* 工具栏 - 不打印 */}
      <div className="no-print flex items-center gap-3 mb-6">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          打印
        </Button>
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          导出 PDF
        </Button>
        <Button 
          variant={preferHandwritten ? "default" : "outline"} 
          onClick={toggleHandwritten}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          {preferHandwritten ? '✍️ 手写优先' : '📋 打印优先'}
        </Button>
      </div>

      {/* A4 打印区域 */}
      <div className="a4-page">
        {/* 明信片 1 */}
        <div className="postcard-item">
          <div className="postcard-front">
            <div className="postcard-header">
              <span className="country-badge">{recipientCountry}</span>
              <span className="recipient-name">To: {recipientName}</span>
            </div>
            <div className="postcard-content">
              {content}
            </div>
            <div className="postcard-footer">
              <span className="sender-city">{senderCity}</span>
              <span className="postmark">✉️</span>
            </div>
          </div>
          {/* 剪切线 */}
          <div className="cut-line"></div>
        </div>
      </div>

      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .a4-page {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .postcard-item {
            page-break-after: always;
          }
        }
        
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .postcard-item {
          margin-bottom: 20px;
        }
        
        .postcard-front {
          width: 100%;
          height: 148mm;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 15mm;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        
        .postcard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          border-bottom: 1px dashed #ccc;
          margin-bottom: 15px;
        }
        
        .country-badge {
          background: linear-gradient(135deg, #f97316, #eab308);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: bold;
        }
        
        .recipient-name {
          font-size: 14px;
          color: #666;
        }
        
        .postcard-content {
          flex: 1;
          font-size: 14px;
          line-height: 1.8;
          white-space: pre-wrap;
          overflow: hidden;
        }
        
        .postcard-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px dashed #ccc;
          margin-top: 15px;
        }
        
        .sender-city {
          font-size: 12px;
          color: #999;
        }
        
        .postmark {
          font-size: 24px;
        }
        
        .cut-line {
          border-top: 1px dashed #999;
          margin: 10px 0;
          position: relative;
        }
        
        .cut-line::before {
          content: '✂️ 剪切线';
          position: absolute;
          left: 50%;
          top: -10px;
          transform: translateX(-50%);
          background: white;
          padding: 0 10px;
          font-size: 10px;
          color: #999;
        }
      `}</style>
    </div>
  );
}
