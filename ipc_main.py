"""
Entry point for bundled Python backend (PyInstaller).

This wrapper ensures the app package is on the path and imports
are resolved correctly when running as a standalone executable.
"""
import sys
import os

# Keep CPU thread fan-out bounded to reduce whole-system contention.
_DEFAULT_CPU_THREAD_LIMIT = 2


def _parse_cpu_thread_limit() -> int:
    raw = os.environ.get("OTTO_CPU_THREAD_LIMIT", str(_DEFAULT_CPU_THREAD_LIMIT))
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return _DEFAULT_CPU_THREAD_LIMIT
    return max(1, parsed)


def _configure_runtime_limits() -> None:
    cpu_limit = _parse_cpu_thread_limit()
    cpu_limit_str = str(cpu_limit)

    thread_limit_envs = [
        "OMP_NUM_THREADS",
        "OPENBLAS_NUM_THREADS",
        "MKL_NUM_THREADS",
        "VECLIB_MAXIMUM_THREADS",
        "NUMEXPR_NUM_THREADS",
        "BLIS_NUM_THREADS",
    ]

    for key in thread_limit_envs:
        if not os.environ.get(key):
            os.environ[key] = cpu_limit_str

    if not os.environ.get("TOKENIZERS_PARALLELISM"):
        os.environ["TOKENIZERS_PARALLELISM"] = "false"

    try:
        import torch
        torch.set_num_threads(cpu_limit)
    except Exception:
        # torch is optional in this runtime path
        pass

    print(f"[IPC] Runtime CPU thread limit: {cpu_limit}", file=sys.stderr, flush=True)


_configure_runtime_limits()

# Ensure the app package is importable from the correct directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == '__main__':
    from app.ipc_server import IPCServer
    server = IPCServer()
    server.run()
