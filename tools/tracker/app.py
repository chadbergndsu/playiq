"""Local PlayIQ player/ball tracker.

Runs entirely on the coach's Mac. Video is accepted over localhost, written to a
temporary file, analyzed, and deleted before the response returns.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import re
import shutil
import tempfile
import threading
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import cv2
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

MODEL_NAME = os.getenv("PLAYIQ_TRACKER_MODEL", "yolo11n.pt")
MAX_UPLOAD_BYTES = int(os.getenv("PLAYIQ_TRACKER_MAX_BYTES", str(8 * 1024**3)))
PLAYER_CLASS = 0
SPORTS_BALL_CLASS = 32

app = FastAPI(title="PlayIQ Local Tracker", version="1")
TRACKER_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "PLAYIQ_TRACKER_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080,http://[::1]:8080",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=TRACKER_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):8080$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

ALLOWED_BROWSER_ORIGINS = set(TRACKER_ORIGINS)


def allowed_browser_origin(origin: str) -> bool:
    if origin in ALLOWED_BROWSER_ORIGINS:
        return True
    parsed = urlparse(origin)
    if parsed.scheme != "http" or parsed.port != 8080 or not parsed.hostname:
        return False
    if parsed.hostname == "localhost":
        return True
    try:
        return ipaddress.ip_address(parsed.hostname).is_private
    except ValueError:
        return False


@app.middleware("http")
async def protect_loopback(request: Request, call_next: Any) -> Any:
    """Reject scripted requests from unrelated websites before parsing video data."""
    if request.method == "POST":
        origin = request.headers.get("origin")
        if origin and not allowed_browser_origin(origin):
            raise HTTPException(status_code=403, detail="Origin not allowed")
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_BYTES + 1024 * 1024:
            raise HTTPException(status_code=413, detail="Video exceeds local tracker size limit")
    return await call_next(request)

_model: YOLO | None = None
_ocr: Any | None = None
_ocr_attempted = False
_analysis_lock = asyncio.Lock()


def model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(MODEL_NAME)
    return _model


def ocr_reader() -> Any | None:
    global _ocr, _ocr_attempted
    if _ocr_attempted:
        return _ocr
    _ocr_attempted = True
    try:
        import easyocr

        _ocr = easyocr.Reader(["en"], gpu=False, verbose=False)
    except Exception as exc:  # OCR remains optional; tracking still works.
        print(f"[tracker] jersey OCR unavailable: {exc}", flush=True)
        _ocr = None
    return _ocr


def parse_roster(raw: str) -> set[int]:
    try:
        values = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid roster_numbers JSON") from exc
    if not isinstance(values, list):
        raise HTTPException(status_code=400, detail="roster_numbers must be a list")
    return {int(value) for value in values if isinstance(value, (int, float, str)) and str(value).isdigit()}


def normalized_box(xyxy: list[float], width: int, height: int) -> dict[str, float]:
    x1, y1, x2, y2 = xyxy
    return {
        "x": max(0.0, min(1.0, x1 / width)),
        "y": max(0.0, min(1.0, y1 / height)),
        "width": max(0.0, min(1.0, (x2 - x1) / width)),
        "height": max(0.0, min(1.0, (y2 - y1) / height)),
    }


def jersey_crop(frame: Any, xyxy: list[float]) -> Any | None:
    """Crop upper-middle torso, where jersey digits are usually visible."""
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = xyxy
    box_w = x2 - x1
    box_h = y2 - y1
    left = max(0, int(x1 + box_w * 0.15))
    right = min(width, int(x2 - box_w * 0.15))
    top = max(0, int(y1 + box_h * 0.12))
    bottom = min(height, int(y1 + box_h * 0.62))
    if right - left < 18 or bottom - top < 18:
        return None
    return frame[top:bottom, left:right]


def read_jersey(frame: Any, xyxy: list[float], roster: set[int]) -> tuple[int, float] | None:
    reader = ocr_reader()
    crop = jersey_crop(frame, xyxy)
    if reader is None or crop is None:
        return None
    try:
        results = reader.readtext(
            crop,
            allowlist="0123456789",
            detail=1,
            paragraph=False,
            width_ths=0.9,
        )
    except Exception:
        return None
    best: tuple[int, float] | None = None
    for _bounds, text, confidence in results:
        digits = re.sub(r"\D", "", text)
        if not digits or len(digits) > 2:
            continue
        number = int(digits)
        score = float(confidence)
        if number not in roster or score < 0.25:
            continue
        if best is None or score > best[1]:
            best = (number, score)
    return best


def device_name() -> str:
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": device_name(),
        "ocrAvailable": ocr_reader() is not None,
    }


async def save_upload(upload: UploadFile, path: Path) -> None:
    total = 0
    with path.open("wb") as output:
        while chunk := await upload.read(8 * 1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Video exceeds local tracker size limit")
            output.write(chunk)


def analyze_window(
    source: Path,
    *,
    film_id: str,
    file_name: str,
    roster: set[int],
    fps_target: float,
    start_sec: float,
    end_sec: float,
    cancelled: threading.Event,
) -> dict[str, Any]:
    warnings: list[str] = [
        "Jersey numbers are OCR suggestions until a coach confirms them.",
        "Ball detection is best-effort and may disappear when occluded.",
    ]
    capture = cv2.VideoCapture(str(source))
    try:
        if hasattr(cv2, "CAP_PROP_ORIENTATION_AUTO"):
            capture.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = frame_count / source_fps if frame_count else 0.0
        if width <= 0 or height <= 0:
            raise HTTPException(status_code=400, detail="Could not read video dimensions")

        start = max(0.0, float(start_sec))
        end = min(duration, float(end_sec)) if duration > 0 else float(end_sec)
        if end <= start:
            raise HTTPException(status_code=400, detail="Invalid tracking window")
        if end - start > 90:
            raise HTTPException(
                status_code=400,
                detail="Track one play at a time (maximum 90 seconds)",
            )

        stride = max(1, round(source_fps / fps_target))
        actual_fps = source_fps / stride
        raw_frames: list[dict[str, Any]] = []
        jersey_votes: dict[str, list[tuple[int, float]]] = defaultdict(list)
        ocr_every = max(1, round(actual_fps))
        start_frame = max(0, round(start * source_fps))
        end_frame = max(start_frame + 1, round(end * source_fps))
        capture.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        local_model = model()
        # Reset ByteTrack between play windows so track ids never leak across jobs.
        local_model.predictor = None
        frame_index = start_frame
        analyzed_index = 0
        while frame_index <= end_frame:
            if cancelled.is_set():
                raise RuntimeError("Analysis cancelled")
            ok, frame = capture.read()
            if not ok:
                break
            if (frame_index - start_frame) % stride != 0:
                frame_index += 1
                continue
            height, width = frame.shape[:2]
            t = frame_index / source_fps
            result_list = local_model.track(
                source=frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=[PLAYER_CLASS, SPORTS_BALL_CLASS],
                conf=0.15,
                iou=0.5,
                verbose=False,
                device=device_name(),
            )
            result = result_list[0]
            detections: list[dict[str, Any]] = []
            boxes = result.boxes
            if boxes is None:
                raw_frames.append({"t": round(t, 3), "detections": detections})
                analyzed_index += 1
                frame_index += 1
                continue
            xyxys = boxes.xyxy.cpu().tolist()
            classes = boxes.cls.int().cpu().tolist()
            confidences = boxes.conf.cpu().tolist()
            ids = boxes.id.int().cpu().tolist() if boxes.id is not None else []

            for index, (xyxy, class_id, confidence) in enumerate(
                zip(xyxys, classes, confidences, strict=False)
            ):
                kind = "player" if class_id == PLAYER_CLASS else "ball"
                if kind == "player":
                    track_number = ids[index] if index < len(ids) else index
                    track_id = f"player-{track_number}"
                else:
                    track_number = ids[index] if index < len(ids) else index
                    track_id = f"ball-{track_number}"
                detection: dict[str, Any] = {
                    "trackId": track_id,
                    "kind": kind,
                    "box": normalized_box(xyxy, width, height),
                    "confidence": round(float(confidence), 4),
                }
                detections.append(detection)

                if (
                    kind == "player"
                    and roster
                    and analyzed_index % ocr_every == 0
                ):
                    suggestion = read_jersey(frame, xyxy, roster)
                    if suggestion:
                        jersey_votes[track_id].append(suggestion)
            raw_frames.append({"t": round(t, 3), "detections": detections})
            analyzed_index += 1
            frame_index += 1

        track_jerseys: dict[str, tuple[int, float]] = {}
        for track_id, votes in jersey_votes.items():
            by_number: dict[int, list[float]] = defaultdict(list)
            for number, confidence in votes:
                by_number[number].append(confidence)
            ranked = sorted(
                by_number.items(),
                key=lambda item: (len(item[1]), sum(item[1]) / len(item[1])),
                reverse=True,
            )
            if not ranked:
                continue
            number, confidences = ranked[0]
            # Repeated sightings raise trust but remain a suggestion.
            mean = sum(confidences) / len(confidences)
            aggregate = min(0.99, mean * (0.7 + min(len(confidences), 4) * 0.075))
            if aggregate >= 0.35:
                track_jerseys[track_id] = (number, aggregate)

        for frame in raw_frames:
            for detection in frame["detections"]:
                suggestion = track_jerseys.get(detection["trackId"])
                if suggestion:
                    detection["jerseyNumber"] = suggestion[0]
                    detection["jerseyConfidence"] = round(suggestion[1], 4)

        if ocr_reader() is None:
            warnings.append("Jersey OCR is unavailable; player boxes and tracks still work.")
        if not any(
            detection["kind"] == "ball"
            for frame in raw_frames
            for detection in frame["detections"]
        ):
            warnings.append("No confident ball detections were found in this video.")

        return {
            "version": 1,
            "filmId": film_id,
            "sourceFileName": file_name,
            "width": width,
            "height": height,
            "analyzedFps": round(actual_fps, 3),
            "durationSec": round(duration, 3),
            "model": MODEL_NAME,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "frames": raw_frames,
            "warnings": warnings,
        }
    finally:
        capture.release()


@app.post("/analyze")
async def analyze(
    request: Request,
    video: UploadFile = File(...),
    film_id: str = Form(...),
    roster_numbers: str = Form("[]"),
    analyzed_fps: float = Form(5.0),
    start_sec: float = Form(...),
    end_sec: float = Form(...),
) -> dict[str, Any]:
    if not film_id or len(film_id) > 160:
        raise HTTPException(status_code=400, detail="Invalid film_id")
    if _analysis_lock.locked():
        raise HTTPException(status_code=409, detail="Another tracking job is already running")

    fps_target = max(1.0, min(10.0, float(analyzed_fps)))
    roster = parse_roster(roster_numbers)
    suffix = Path(video.filename or "film.mp4").suffix or ".mp4"
    temp_dir = Path(tempfile.mkdtemp(prefix="playiq-tracker-"))
    source = temp_dir / f"source{suffix}"
    cancelled = threading.Event()

    try:
        async with _analysis_lock:
            await save_upload(video, source)
            task = asyncio.create_task(
                asyncio.to_thread(
                    analyze_window,
                    source,
                    film_id=film_id,
                    file_name=video.filename or "film.mp4",
                    roster=roster,
                    fps_target=fps_target,
                    start_sec=start_sec,
                    end_sec=end_sec,
                    cancelled=cancelled,
                )
            )
            while not task.done():
                if await request.is_disconnected():
                    cancelled.set()
                await asyncio.sleep(0.25)
            return await task
    except HTTPException:
        raise
    except RuntimeError as exc:
        if str(exc) == "Analysis cancelled":
            raise HTTPException(status_code=499, detail="Analysis cancelled") from exc
        print(f"[tracker] analysis failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail="Local tracking analysis failed") from exc
    except Exception as exc:
        print(f"[tracker] analysis failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail="Local tracking analysis failed") from exc
    finally:
        cancelled.set()
        await video.close()
        shutil.rmtree(temp_dir, ignore_errors=True)
