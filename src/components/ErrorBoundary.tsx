'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo?.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} info={this.state.errorInfo} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, info }: { error?: Error; info?: ErrorInfo }) {
  const say = usePhrase();
  return (
    <div className="p-8 text-center text-red-600">
      <h2>{say("Something went wrong.")}</h2>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        {error && error.toString()}
        <br />
        {say(info?.componentStack)}
      </details>
    </div>
  );
}
