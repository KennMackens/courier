"""
Entry point for bundled Python backend (PyInstaller).

This wrapper ensures the app package is on the path and imports
are resolved correctly when running as a standalone executable.
"""
import sys
import os

# Ensure the app package is importable from the correct directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == '__main__':
    from app.ipc_server import IPCServer
    server = IPCServer()
    server.run()
