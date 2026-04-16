'use client';

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <div className="space-y-2">
          <p>❌ 发生错误：{error.message}</p>
          <button
            onClick={resetErrorBoundary}
            className="text-sm underline text-blue-600 hover:text-blue-800"
          >
            重试
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
