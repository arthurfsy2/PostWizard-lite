import { jsPDF } from 'jspdf';
import { PostcardContent } from '../types';

export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf';
  contentIds?: string[];
  postcardIds?: string[];
  includeMetadata?: boolean;
  includeRecipient?: boolean;
  includeSignature?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
}

/**
 * 导出服务类
 */
export class ExportService {
  /**
   * 导出为 Markdown 格式
   */
  exportToMarkdown(postcard: PostcardContent, options?: Partial<ExportOptions>) {
    const { includeRecipient = true, includeSignature = true } = options || {};
    
    let markdown = `# Postcard to ${postcard.recipientName}

**Postcard ID:** ${postcard.postcardId}
`;
    if (includeRecipient) {
      markdown += `**Country:** ${postcard.country}
**Sender City:** ${postcard.senderCity}

`;
    } else {
      markdown += `
`;
    }

    markdown += `${postcard.greeting}

## Content

${postcard.body}

`;

    if (includeSignature) {
      markdown += `## Additional Information

**Weather:** ${postcard.weather}
**Local Culture:** ${postcard.localCulture}
**Personal Touch:** ${postcard.personalTouch}

${postcard.closing}
`;
    } else {
      markdown += `${postcard.closing}
`;
    }

    return {
      format: 'markdown',
      filename: `postcard_${postcard.postcardId}.md`,
      content: markdown,
    };
  }

  /**
   * 批量导出为 Markdown（合并为一个文件）
   */
  exportBatchToMarkdown(postcards: PostcardContent[], options?: Partial<ExportOptions>) {
    const { includeRecipient = true, includeSignature = true } = options || {};
    
    let markdown = `# Postcards Export

**Total:** ${postcards.length} postcards
**Exported:** ${new Date().toLocaleString('zh-CN')}

---

`;

    postcards.forEach((postcard, index) => {
      markdown += `## ${index + 1}. Postcard to ${postcard.recipientName}

**Postcard ID:** ${postcard.postcardId}
`;
      if (includeRecipient) {
        markdown += `**Country:** ${postcard.country}
**Sender City:** ${postcard.senderCity}
`;
      }
      
      markdown += `
${postcard.greeting}

${postcard.body}

`;

      if (includeSignature) {
        markdown += `*Weather: ${postcard.weather}*
*${postcard.personalTouch}*

${postcard.closing}
`;
      } else {
        markdown += `${postcard.closing}
`;
      }

      markdown += `\n---\n\n`;
    });

    return {
      format: 'markdown',
      filename: `postcards_batch_${postcards.length}.md`,
      content: markdown,
    };
  }

  /**
   * 导出为 HTML 格式
   */
  exportToHtml(postcard: PostcardContent, options?: Partial<ExportOptions>) {
    const { includeRecipient = true, includeSignature = true, fontSize = 'medium' } = options || {};
    
    const fontSizeMap = {
      small: { body: '14px', title: '20px', meta: '12px' },
      medium: { body: '16px', title: '24px', meta: '14px' },
      large: { body: '18px', title: '28px', meta: '16px' },
    };
    
    const sizes = fontSizeMap[fontSize];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Postcard to ${postcard.recipientName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .postcard {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .postcard h1 {
      font-size: ${sizes.title};
      margin-bottom: 15px;
    }
    .metadata {
      font-size: ${sizes.meta};
      color: #666;
      margin-bottom: 15px;
    }
    .content {
      font-size: ${sizes.body};
      white-space: pre-wrap;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 4px;
      border-left: 4px solid #007bff;
    }
  </style>
</head>
<body>
  <div class="postcard">
    <h1>Postcard to ${postcard.recipientName}</h1>
    ${includeRecipient ? `
    <div class="metadata">
      <strong>Postcard ID:</strong> ${postcard.postcardId}<br>
      <strong>Country:</strong> ${postcard.country}<br>
      <strong>Sender City:</strong> ${postcard.senderCity}
    </div>
    ` : `
    <div class="metadata">
      <strong>Postcard ID:</strong> ${postcard.postcardId}
    </div>
    `}
    <div class="content">
${postcard.greeting}

${postcard.body}
${includeSignature ? `

${postcard.closing}

---
Weather: ${postcard.weather}
${postcard.personalTouch}` : `

${postcard.closing}`}
    </div>
  </div>
</body>
</html>`;

    return {
      format: 'html',
      filename: `postcard_${postcard.postcardId}.html`,
      content: html,
    };
  }

  /**
   * 导出为 PDF 格式
   */
  exportToPdf(postcard: PostcardContent, options?: Partial<ExportOptions>) {
    const { includeRecipient = true, includeSignature = true } = options || {};
    
    const doc = new jsPDF();
    
    // 设置字体
    doc.setFont('helvetica');
    
    // 标题
    doc.setFontSize(20);
    doc.text(`Postcard to ${postcard.recipientName}`, 20, 30);
    
    // 元信息
    doc.setFontSize(12);
    let y = 50;
    doc.text(`Postcard ID: ${postcard.postcardId}`, 20, y);
    y += 10;
    
    if (includeRecipient) {
      doc.text(`Country: ${postcard.country}`, 20, y);
      y += 10;
      doc.text(`Sender City: ${postcard.senderCity}`, 20, y);
      y += 10;
    }
    
    // 内容
    y += 10;
    doc.setFontSize(14);
    const greetingLines = doc.splitTextToSize(postcard.greeting, 170);
    doc.text(greetingLines, 20, y);
    y += greetingLines.length * 7 + 10;
    
    doc.setFontSize(12);
    const bodyLines = doc.splitTextToSize(postcard.body, 170);
    doc.text(bodyLines, 20, y);
    y += bodyLines.length * 6 + 10;
    
    // 结束语
    doc.setFontSize(14);
    const closingLines = doc.splitTextToSize(postcard.closing, 170);
    doc.text(closingLines, 20, y);
    
    if (includeSignature) {
      y += closingLines.length * 7 + 10;
      doc.setFontSize(10);
      doc.text(`Weather: ${postcard.weather}`, 20, y);
      y += 6;
      doc.text(postcard.personalTouch, 20, y);
    }

    return {
      format: 'pdf',
      filename: `postcard_${postcard.postcardId}.pdf`,
      content: doc.output('datauristring'),
    };
  }

  /**
   * 批量导出为 PDF（多页）
   */
  exportBatchToPdf(postcards: PostcardContent[], options?: Partial<ExportOptions>) {
    const { includeRecipient = true, includeSignature = true } = options || {};
    
    const doc = new jsPDF();
    
    postcards.forEach((postcard, index) => {
      if (index > 0) {
        doc.addPage();
      }
      
      // 设置字体
      doc.setFont('helvetica');
      
      // 页码
      doc.setFontSize(10);
      doc.text(`${index + 1} / ${postcards.length}`, 180, 10);
      
      // 标题
      doc.setFontSize(20);
      doc.text(`Postcard to ${postcard.recipientName}`, 20, 30);
      
      // 元信息
      doc.setFontSize(12);
      let y = 50;
      doc.text(`Postcard ID: ${postcard.postcardId}`, 20, y);
      y += 10;
      
      if (includeRecipient) {
        doc.text(`Country: ${postcard.country}`, 20, y);
        y += 10;
        doc.text(`Sender City: ${postcard.senderCity}`, 20, y);
        y += 10;
      }
      
      // 内容
      y += 10;
      doc.setFontSize(14);
      const greetingLines = doc.splitTextToSize(postcard.greeting, 170);
      doc.text(greetingLines, 20, y);
      y += greetingLines.length * 7 + 10;
      
      doc.setFontSize(12);
      const bodyLines = doc.splitTextToSize(postcard.body, 170);
      doc.text(bodyLines, 20, y);
      y += bodyLines.length * 6 + 10;
      
      // 结束语
      doc.setFontSize(14);
      const closingLines = doc.splitTextToSize(postcard.closing, 170);
      doc.text(closingLines, 20, y);
      
      if (includeSignature) {
        y += closingLines.length * 7 + 10;
        doc.setFontSize(10);
        doc.text(`Weather: ${postcard.weather}`, 20, y);
        y += 6;
        doc.text(postcard.personalTouch, 20, y);
      }
    });

    return {
      format: 'pdf',
      filename: `postcards_batch_${postcards.length}.pdf`,
      content: doc.output('datauristring'),
    };
  }

  /**
   * 导出为 JSON 格式
   */
  exportToJson(postcard: PostcardContent) {
    return {
      format: 'json',
      filename: `postcard_${postcard.postcardId}.json`,
      content: JSON.stringify(postcard, null, 2),
    };
  }

  /**
   * 批量导出为 JSON
   */
  exportBatchToJson(postcards: PostcardContent[]) {
    return {
      format: 'json',
      filename: `postcards_batch_${postcards.length}.json`,
      content: JSON.stringify(postcards, null, 2),
    };
  }

  /**
   * 批量导出（通用方法）
   */
  exportAll(postcards: PostcardContent[], format: string, options?: Partial<ExportOptions>) {
    switch (format) {
      case 'html':
        return postcards.map(p => this.exportToHtml(p, options));
      case 'json':
        return [this.exportBatchToJson(postcards)];
      case 'pdf':
        return [this.exportBatchToPdf(postcards, options)];
      default:
        return [this.exportBatchToMarkdown(postcards, options)];
    }
  }

  // === Legacy database-dependent methods (kept for backward compatibility) ===

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 批量导出为 ZIP（预留功能）
   */
  async exportToZip(_options: ExportOptions): Promise<Buffer> {
    throw new Error('ZIP 导出功能尚未实现');
  }
}

// 导出服务实例
export const exportService = new ExportService();
