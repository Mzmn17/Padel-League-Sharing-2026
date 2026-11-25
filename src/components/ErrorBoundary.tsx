import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function formatErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed?.error) {
      if (parsed.error.toLowerCase().includes('missing or insufficient permissions')) {
        return `Akses ditolak (${parsed.operationType || 'read'} pada ${parsed.path || 'database'}). Silakan login dengan akun Admin yang berwenang.`;
      }
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return raw || 'Terjadi kesalahan pada aplikasi.';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: formatErrorMessage(error.message),
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06133B] flex items-center justify-center p-6">
          <div className="bg-[#0A1D52] border border-red-500/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <h1 className="text-lg font-bold text-red-300">Terjadi Kendala Aplikasi</h1>
            <p className="text-xs text-blue-100/80 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
