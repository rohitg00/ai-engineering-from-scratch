import json
import ipaddress
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request


def _validate_endpoint(endpoint):
    if (
        not isinstance(endpoint, str)
        or not endpoint
        or any(ord(char) <= 32 or ord(char) == 127 or char == "\\" for char in endpoint)
    ):
        raise ValueError("Use an explicit endpoint without whitespace or backslashes")
    try:
        parsed = urllib.parse.urlsplit(endpoint)
        host, port = parsed.hostname, parsed.port
    except ValueError as error:
        raise ValueError("Invalid endpoint authority") from error
    if (
        parsed.scheme not in ("http", "https")
        or not host
        or parsed.username is not None
        or parsed.password is not None
        or parsed.netloc.endswith(":")
        or (
            parsed.netloc.startswith("[")
            and not re.fullmatch(r"\[[^\]]+\](?::[0-9]+)?", parsed.netloc)
        )
        or port == 0
        or "#" in endpoint
    ):
        raise ValueError(
            "Use an HTTP(S) endpoint without URL credentials or a fragment"
        )
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        try:
            dns_name = host.encode("idna").decode("ascii")
        except UnicodeError as error:
            raise ValueError("Invalid endpoint hostname") from error
        labels = dns_name.rstrip(".").split(".")
        if len(dns_name) > 253 or any(
            not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label)
            for label in labels
        ):
            raise ValueError("Invalid endpoint hostname")
        loopback = host == "localhost"
    else:
        loopback = address.is_loopback
    if parsed.scheme == "http" and not loopback:
        raise ValueError("Remote endpoints require HTTPS; HTTP is only for loopback")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def http_recognizer(endpoint, model="whisper-1", api_key="", timeout=30):
    _validate_endpoint(endpoint)
    if (
        not isinstance(model, str)
        or not model.strip()
        or any(c in model for c in "\r\n")
    ):
        raise ValueError("A valid transcription model is required")
    if not 0 < timeout <= 120:
        raise ValueError("Timeout must be between 0 and 120 seconds")

    def recognize(wav):
        if (
            not isinstance(wav, bytes)
            or not wav.startswith(b"RIFF")
            or wav[8:12] != b"WAVE"
            or len(wav) > 20_000_000
        ):
            raise ValueError("Recognizer requires WAV bytes of at most 20 MB")
        boundary = "aiefs-" + secrets.token_hex(16)
        body = (
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n{model}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="segment.wav"\r\nContent-Type: audio/wav\r\n\r\n'
            ).encode()
            + wav
            + f"\r\n--{boundary}--\r\n".encode()
        )
        headers = {"Content-Type": "multipart/form-data; boundary=" + boundary}
        if api_key:
            headers["Authorization"] = "Bearer " + api_key
        request = urllib.request.Request(endpoint, body, headers, method="POST")
        try:
            opener = urllib.request.build_opener(_NoRedirect())
            with opener.open(request, timeout=timeout) as response:
                raw = response.read(1_000_001)
        except urllib.error.URLError as error:
            if isinstance(error.reason, TimeoutError):
                raise TimeoutError("Transcription request timed out") from error
            raise
        if len(raw) > 1_000_000:
            raise ValueError("Transcription response exceeds 1 MB")
        result = json.loads(raw)
        if (
            not isinstance(result, dict)
            or not isinstance(result.get("text"), str)
            or not result["text"].strip()
        ):
            raise ValueError("Recognizer returned no usable text")
        return result["text"].strip()

    return recognize
