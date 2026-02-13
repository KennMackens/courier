# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Otto Python backend.

This bundles the Python IPC server with all ML dependencies (MLX, Whisper, etc.)
into a standalone executable for macOS.
"""

from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Keep hidden imports minimal; broad collect_submodules pulls in large optional stacks.
hiddenimports = [
    # App modules
    'app',
    'app.constants',
    'app.ipc_server',
    'app.ipc_protocol',
    'app.recorder',
    'app.transcriber',
    'app.mlx_inference',
    'app.model_manager',
    'app.prompts',
    # Runtime-loaded ML modules
    'mlx',
    'mlx.core',
    'mlx_lm',
    'mlx_lm.sample_utils',
    'faster_whisper',
    'tokenizers',
    'huggingface_hub',
    'safetensors',
]

# Keep only package metadata/resources needed at runtime.
datas = [
    *collect_data_files('mlx_lm'),
    *collect_data_files('tokenizers'),
    *collect_data_files('huggingface_hub'),
]

a = Analysis(
    ['ipc_main.py'],
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
        # Exclude optional ML/training backends not used by Otto runtime
        'torch',
        'torchvision',
        'torchaudio',
        'torchtext',
        'tensorflow',
        'keras',
        'jax',
        'jaxlib',
        'flax',
        # Exclude notebook/visualization stacks
        'IPython',
        'ipykernel',
        'jupyter',
        'notebook',
        'matplotlib',
        'PIL',
        # Exclude optional scientific tooling and tests
        'numba',
        'llvmlite',
        'scipy',
        'numpy.tests',
        'scipy.tests',
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
