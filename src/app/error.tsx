'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    // console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">出现了一些问题</h2>
        <p className="text-muted-foreground">
          抱歉，页面加载时发生了错误。
        </p>
        {error.message && (
          <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
            {error.message}
          </p>
        )}
        <Button
          onClick={() => reset()}
          variant="outline"
        >
          重试
        </Button>
      </div>
    </div>
  );
}
