"""
IPC Protocol definitions for Electron <-> Python communication.

Uses JSON-RPC 2.0 inspired format with streaming support.
All messages are line-delimited JSON over stdin/stdout.
"""

import json
import sys
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, Dict
from enum import IntEnum


class ErrorCode(IntEnum):
    """Standard JSON-RPC and custom error codes."""
    # JSON-RPC standard errors
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603

    # Custom application errors
    PERMISSION_DENIED = 1001
    RECORDING_IN_PROGRESS = 1002
    NOT_RECORDING = 1003
    TRANSCRIPTION_ERROR = 1004
    OLLAMA_NOT_AVAILABLE = 1005
    MODEL_NOT_FOUND = 1006
    AUDIO_HELPER_ERROR = 1007
    MODEL_DOWNLOAD_ERROR = 1008
    MODEL_DOWNLOAD_IN_PROGRESS = 1009


@dataclass
class Request:
    """Incoming request from Electron."""
    id: str
    method: str
    params: Optional[Dict[str, Any]] = None
    jsonrpc: str = "2.0"


@dataclass
class Response:
    """Response to send back to Electron."""
    id: str
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    jsonrpc: str = "2.0"

    def to_json(self) -> str:
        """Serialize to JSON string."""
        data = {"jsonrpc": self.jsonrpc, "id": self.id}
        if self.error is not None:
            data["error"] = self.error
        else:
            data["result"] = self.result
        return json.dumps(data)


@dataclass
class StreamEvent:
    """Streaming event for progress/tokens."""
    id: str
    data: Any
    done: bool = False
    stream: bool = True
    jsonrpc: str = "2.0"

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps({
            "jsonrpc": self.jsonrpc,
            "id": self.id,
            "stream": self.stream,
            "data": self.data,
            "done": self.done
        })


@dataclass
class Notification:
    """Unsolicited notification to Electron (no response expected)."""
    method: str
    params: Optional[Dict[str, Any]] = None
    jsonrpc: str = "2.0"

    def to_json(self) -> str:
        """Serialize to JSON string."""
        data = {"jsonrpc": self.jsonrpc, "method": self.method}
        if self.params is not None:
            data["params"] = self.params
        return json.dumps(data)


def parse_request(line: str) -> Request:
    """
    Parse a JSON-RPC request from a line of input.

    Args:
        line: JSON string containing the request

    Returns:
        Parsed Request object

    Raises:
        ValueError: If the request is invalid
    """
    try:
        data = json.loads(line)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

    if not isinstance(data, dict):
        raise ValueError("Request must be a JSON object")

    if data.get("jsonrpc") != "2.0":
        raise ValueError("Invalid or missing jsonrpc version")

    if "id" not in data:
        raise ValueError("Missing request id")

    if "method" not in data:
        raise ValueError("Missing method")

    return Request(
        id=str(data["id"]),
        method=data["method"],
        params=data.get("params"),
        jsonrpc=data["jsonrpc"]
    )


def make_error(request_id: str, code: int, message: str, data: Any = None) -> Response:
    """Create an error response."""
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return Response(id=request_id, error=error)


def make_result(request_id: str, result: Any) -> Response:
    """Create a success response."""
    return Response(id=request_id, result=result)


def make_stream(request_id: str, data: Any, done: bool = False) -> StreamEvent:
    """Create a stream event."""
    return StreamEvent(id=request_id, data=data, done=done)


class IPCWriter:
    """
    Thread-safe writer for IPC messages.

    Writes to stdout with proper flushing for immediate delivery.
    """

    def __init__(self):
        self._stdout = sys.stdout

    def send(self, message: Response | StreamEvent | Notification) -> None:
        """Send a message to Electron."""
        line = message.to_json()
        self._stdout.write(line + "\n")
        self._stdout.flush()

    def send_result(self, request_id: str, result: Any) -> None:
        """Send a success response."""
        self.send(make_result(request_id, result))

    def send_error(self, request_id: str, code: int, message: str, data: Any = None) -> None:
        """Send an error response."""
        self.send(make_error(request_id, code, message, data))

    def send_stream(self, request_id: str, data: Any, done: bool = False) -> None:
        """Send a stream event."""
        self.send(make_stream(request_id, data, done))

    def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        """Send an unsolicited notification."""
        self.send(Notification(method=method, params=params))


class IPCReader:
    """
    Reader for IPC requests from stdin.

    Reads line-by-line and parses JSON-RPC requests.
    """

    def __init__(self):
        self._stdin = sys.stdin

    def __iter__(self):
        """Iterate over incoming requests."""
        return self

    def __next__(self) -> Request:
        """Read and parse the next request."""
        line = self._stdin.readline()
        if not line:
            raise StopIteration
        return parse_request(line.strip())
