import { NextRequest, NextResponse } from 'next/server';
import Imap from 'imap';

/**
 * POST /api/email-configs/test-connection
 * 测试 IMAP 连接并获取文件夹列表
 *
 * Request body:
 * - imapHost: IMAP 服务器地址
 * - imapPort: IMAP 端口
 * - imapUsername: IMAP 用户名
 * - imapPassword: IMAP 密码/授权码
 * - useTLS: 是否使用 TLS（可选，默认 true）
 * - rejectUnauthorized: 是否验证证书（可选，默认 false）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imapHost, imapPort, imapUsername, imapPassword, useTLS = true, rejectUnauthorized = false } = body;

    // 验证必填字段
    if (!imapHost || !imapPort || !imapUsername || !imapPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：IMAP 服务器、端口、用户名和密码',
          errorCode: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    // 创建临时 IMAP 连接
    const config = {
      host: imapHost,
      port: parseInt(imapPort),
      tls: useTLS,
      tlsOptions: {
        rejectUnauthorized: rejectUnauthorized,
      },
      user: imapUsername,
      password: imapPassword,
      connTimeout: 30000,
      authTimeout: 30000,
    };

    // 测试连接并获取文件夹列表
    const folders = await new Promise<string[]>((resolve, reject) => {
      const imap = new Imap(config);
      const folderList: string[] = [];

      const timeout = setTimeout(() => {
        imap.end();
        reject(new Error('连接超时'));
      }, 30000);

      imap.once('ready', () => {
        clearTimeout(timeout);

        imap.getBoxes((err, boxes) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          const extractFolders = (boxObj: any, prefix = '') => {
            for (const name in boxObj) {
              const fullPath = prefix ? `${prefix}${name}` : name;
              folderList.push(fullPath);

              if (boxObj[name].children) {
                extractFolders(boxObj[name].children, `${fullPath}/`);
              }
            }
          };

          extractFolders(boxes);
          imap.end();
          resolve(folderList);
        });
      });

      imap.once('error', (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });

      imap.connect();
    });

    return NextResponse.json({
      success: true,
      folders,
      message: `成功获取 ${folders.length} 个文件夹`,
    });
  } catch (error: any) {
    // 处理特定错误
    if (error.message?.includes('认证失败') || error.message?.includes('AUTHENTICATIONFAILED') || error.message?.includes('Invalid')) {
      return NextResponse.json(
        {
          success: false,
          error: '邮箱认证失败，请检查用户名和密码/授权码',
          errorCode: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    if (error.message?.includes('连接') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      return NextResponse.json(
        {
          success: false,
          error: '无法连接到邮箱服务器，请检查 IMAP 设置',
          errorCode: 'CONNECTION_FAILED',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || '连接测试失败',
        errorCode: 'TEST_FAILED',
      },
      { status: 500 }
    );
  }
}
