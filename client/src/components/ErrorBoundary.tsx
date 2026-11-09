import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp, LogIn } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: true,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: true,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("🚨 [Grab ErrorBoundary] Phát hiện lỗi giao diện:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReLogin = () => {
    try {
      localStorage.removeItem("grab_access_token");
      localStorage.removeItem("grab_refresh_token");
    } catch (e) {}
    window.location.href = "/auth";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full bg-[#F5F6F8] flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95">
            {/* Grab Icon */}
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
              <span className="text-3xl">🚗</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Đã có sự cố hiển thị nhỏ
            </h2>

            <p className="text-xs sm:text-sm text-gray-600 mt-2 mb-4 leading-relaxed">
              Ứng dụng vừa gặp lỗi giao diện không mong muốn. Dữ liệu của bạn vẫn an toàn. Vui lòng bấm thử lại để tiếp tục sử dụng.
            </p>

            {/* Hiển thị trực tiếp lỗi để nhận biết */}
            {this.state.error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-left">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                  Thông điệp lỗi kỹ thuật:
                </span>
                <p className="text-xs font-mono font-bold text-rose-800 break-words leading-relaxed">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            {/* Thao tác phục hồi */}
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-4">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black py-3 px-4 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex-1 bg-gray-100 hover:bg-gray-200 active:scale-[0.99] text-gray-800 font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Home className="w-4 h-4" />
                <span>Về trang chủ</span>
              </button>

              <button
                type="button"
                onClick={this.handleReLogin}
                className="w-full sm:w-auto bg-gray-50 hover:bg-gray-100 active:scale-[0.99] text-gray-600 hover:text-gray-900 font-bold py-3 px-3 rounded-2xl border border-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                title="Xóa token cũ và đăng nhập lại"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập lại</span>
              </button>
            </div>

            {/* Chi tiết Stack trace (Mở rộng) */}
            {this.state.error && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="flex items-center justify-between w-full text-[11px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    Stack trace chi tiết
                  </span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-gray-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-48 leading-relaxed">
                    <p className="font-bold text-rose-400">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-gray-400 mt-1 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
