import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';

/**
 * GET /api/settings/payment
 * 公开获取支付配置（无需登录）
 */
export async function GET(request: NextRequest) {
  try {
    // 读取 public/settings/payment-config.json
    const configPath = path.join(process.cwd(), 'public', 'settings', 'payment-config.json');
    
    const defaultConfig = {
      customerServiceEmail: 'teams@postwizard.cn',
      paymentQrCode: '',
      wechatQrCode: '',
    };

    let config = defaultConfig;

    try {
      if (existsSync(configPath)) {
        const fs = await import('fs');
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        config = { ...defaultConfig, ...JSON.parse(fileContent) };
      }
    } catch (e) {
      // 使用默认配置
    }

    return NextResponse.json(config);
  } catch (error) {
    // console.error('Error getting payment settings:', error);
    return NextResponse.json(
      { error: '获取支付设置失败' },
      { status: 500 }
    );
  }
}
