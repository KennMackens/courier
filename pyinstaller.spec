# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Otto Python backend.

This bundles the Python IPC server with all ML dependencies (MLX, Whisper, etc.)
into a standalone executable for macOS.
"""

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all submodules for complex packages
hiddenimports = [
    # MLX and ML packages
    *collect_submodules('mlx'),
    *collect_submodules('mlx_lm'),
    *collect_submodules('faster_whisper'),
    *collect_submodules('transformers'),
    *collect_submodules('tokenizers'),
    *collect_submodules('huggingface_hub'),
    *collect_submodules('safetensors'),
    # Scientific computing
    *collect_submodules('numpy'),
    *collect_submodules('scipy'),
    # Standard library modules that might be missed
    'json',
    'sys',
    'os',
    'signal',
    'threading',
    'queue',
    'dataclasses',
    'typing',
    'pathlib',
    'tempfile',
    'shutil',
    'subprocess',
    'struct',
    'wave',
    # App modules
    'app',
    'app.ipc_server',
    'app.ipc_protocol',
    'app.recorder',
    'app.transcriber',
    'app.mlx_inference',
    'app.model_manager',
    'app.ollama',
]

# Collect data files for packages that need them
datas = [
    *collect_data_files('mlx'),
    *collect_data_files('faster_whisper'),
    *collect_data_files('transformers'),
    *collect_data_files('tokenizers'),
    *collect_data_files('huggingface_hub'),
]

a = Analysis(
    ['app/ipc_server.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary GUI packages
        'tkinter',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        'wx',
        # Exclude testing packages
        'pytest',
        'unittest',
        '_pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='python-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64',
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='python-backend',
)
