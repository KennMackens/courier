#!/usr/bin/env python3
"""
Courier - Local-first meeting recorder

A privacy-focused meeting recorder that captures system audio + mic,
transcribes it using local models, and generates enhanced notes.
"""

from app.gui import CourierApp


def main():
    app = CourierApp()
    app.run()


if __name__ == "__main__":
    main()
