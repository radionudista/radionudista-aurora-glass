#!/usr/bin/env python3
"""
aup2wav: Convert an Audacity .aup project (v1.x/2.x XML + _data .au blockfiles)
into a .wav file, approximating File -> Export mixdown.

Core behavior
- Parses the AUP XML (per audacityproject.dtd).
- Reconstructs each wavetrack by stitching waveblocks (simpleblockfile, silentblockfile),
  honoring track and clip offsets. Applies clip envelopes and track gain/pan.
- Handles mute/solo (soloed tracks take precedence; otherwise muted tracks excluded).
- Decodes .au blockfiles (Sun/NeXT AU) to float; best-effort support for alias blocks (.wav/.aiff).
- Mixes to stereo using equal-power pan law by default (like typical DAW exports).
- Resamples tracks linearly to the project rate if needed.

Limitations
- pcmaliasblockfile and legacyblockfile: best-effort; unsupported formats are treated as silence.
- Time track (tempo/speed envelope) is ignored.
- No dithering; 16-bit PCM output is clipped to [-1,1].

Usage
  python aup2wav.py input.aup [-o output.wav] [--mixdown mono|stereo] [--multichannel]
  python aup2wav.py input.aup --bitdepth 16|24|32f

This script depends only on the Python standard library.
"""

from __future__ import annotations

import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

import argparse
import os
import sys
import struct
import xml.etree.ElementTree as ET
import sunau
import wave
from array import array
import math
import random
import aifc
from typing import List, Tuple, Optional

# Suppress deprecation warnings from stdlib audio readers (sunau/aifc)
warnings.filterwarnings('ignore', category=DeprecationWarning)

# ---------- Audacity Scripting (experimental, for .aup3/.aup4) ----------
import glob
import time
import subprocess
import sqlite3


def _find_script_pipes() -> Tuple[Optional[str], Optional[str]]:
    # On Linux/macOS: /tmp/audacity_script_pipe.{to,from}.*
    to_candidates = glob.glob('/tmp/audacity_script_pipe.to.*')
    from_candidates = glob.glob('/tmp/audacity_script_pipe.from.*')
    to_pipe = to_candidates[0] if to_candidates else None
    from_pipe = from_candidates[0] if from_candidates else None
    return to_pipe, from_pipe


def _start_audacity_if_needed(audacity_bin: Optional[str]) -> bool:
    to_pipe, from_pipe = _find_script_pipes()
    if to_pipe and from_pipe:
        return True
    # Try to start Audacity in background if binary provided
    bin_path = audacity_bin or 'audacity'
    try:
        subprocess.Popen([bin_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        return False
    # Wait for pipes to appear
    for _ in range(50):  # ~5s
        time.sleep(0.1)
        to_pipe, from_pipe = _find_script_pipes()
        if to_pipe and from_pipe:
            return True
    return False


def _audacity_command(cmd: str, to_path: str, from_path: str, timeout: float = 10.0) -> str:
    # Write command to the to-pipe and read a response line from from-pipe
    # Commands should end with a newline
    with open(to_path, 'w') as to_f:
        to_f.write(cmd + '\n')
        to_f.flush()
    # Read response (blocking) with timeout
    start = time.time()
    resp = ''
    while time.time() - start < timeout:
        try:
            with open(from_path, 'r') as from_f:
                resp = from_f.read()
                if resp:
                    break
        except Exception:
            time.sleep(0.05)
    return resp


def export_aup3_via_audacity(aup3_path: str, out_path: str, args) -> bool:
    """Attempt to export .aup3/.aup4 via a running Audacity with Scripting module enabled.
    This is best-effort and depends on Audacity being installed and scripting enabled.
    """
    if not _start_audacity_if_needed(args.audacity_bin):
        eprint('Could not find Audacity scripting pipes. Start Audacity and enable Tools -> Scripting -> Pipe.')
        return False
    to_pipe, from_pipe = _find_script_pipes()
    if not to_pipe or not from_pipe:
        eprint('Audacity scripting pipes not found.')
        return False
    # Sequence: New project, Open file, SelectAll, Export2, Close
    def send(cmd):
        return _audacity_command(cmd, to_pipe, from_pipe)
    send('New:')
    send(f'Open: Filename="{aup3_path}"')
    send('SelectAll:')
    # Export options: Export2 allows specifying filename; other options are defaults
    send(f'Export2: Filename="{out_path}"')
    # Give export some time
    time.sleep(0.5)
    # We won't attempt to parse responses robustly; just assume success if file exists
    return os.path.isfile(out_path)


# ---------------- Native .aup3 reader (SQLite) ----------------

class _Buf:
    def __init__(self, data: bytes):
        self.d = data
        self.i = 0

    def eof(self) -> bool:
        return self.i >= len(self.d)

    def getc(self) -> int:
        if self.eof():
            raise EOFError
        b = self.d[self.i]
        self.i += 1
        return b

    def read(self, n: int) -> bytes:
        b = self.d[self.i:self.i+n]
        if len(b) < n:
            raise EOFError
        self.i += n
        return b

    def read_u16le(self) -> int:
        b = self.read(2)
        return b[0] | (b[1] << 8)

    def read_i32le(self) -> int:
        b = self.read(4)
        return b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)


def _decode_project_binary_xml(dict_blob: bytes, doc_blob: bytes) -> str:
    # Implements a minimal decoder for ProjectSerializer::Decode
    FT_CharSize = 0
    FT_StartTag = 1
    FT_EndTag = 2
    FT_String = 3
    FT_Int = 4
    FT_Bool = 5
    FT_Long = 6
    FT_LongLong = 7
    FT_SizeT = 8
    FT_Float = 9
    FT_Double = 10
    FT_Data = 11
    FT_Raw = 12
    FT_Push = 13
    FT_Pop = 14
    FT_Name = 15

    buf = _Buf(dict_blob + doc_blob)
    name_ids = {}
    stack_ids = []
    char_size = 1

    # XML building
    out = []
    open_tag = None
    attrs = []
    stack = []  # stack of open element names

    def xml_escape(text: str) -> str:
        return (
            text.replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
        )

    def emit_open():
        nonlocal open_tag, attrs
        if open_tag is None:
            return
        parts = [f"<{open_tag}"]
        for k, v in attrs:
            parts.append(f' {k}="{xml_escape(str(v))}"')
        parts.append('>')
        out.append(''.join(parts))
        stack.append(open_tag)
        open_tag = None
        attrs = []

    def read_string(n: int) -> str:
        data = buf.read(n)
        if char_size == 1:
            return data.decode('utf-8', errors='replace')
        elif char_size == 2:
            return data.decode('utf-16le', errors='replace')
        elif char_size == 4:
            # Python has no utf-32le decoding issues
            return data.decode('utf-32le', errors='replace')
        else:
            return data.decode('utf-8', errors='replace')

    try:
        while not buf.eof():
            t = buf.getc()
            if t == FT_Push:
                stack_ids.append(dict(name_ids))
                name_ids.clear()
            elif t == FT_Pop:
                name_ids = stack_ids.pop() if stack_ids else name_ids
            elif t == FT_Name:
                _id = buf.read_u16le()
                nlen = buf.read_u16le()
                name_ids[_id] = read_string(nlen)
            elif t == FT_CharSize:
                char_size = buf.getc()
            elif t == FT_StartTag:
                _id = buf.read_u16le()
                # If there's a pending open tag, emit it before starting a child
                if open_tag is not None:
                    emit_open()
                open_tag = name_ids.get(_id, f'id{_id}')
                attrs = []
            elif t == FT_EndTag:
                _id = buf.read_u16le()
                name = name_ids.get(_id, f'id{_id}')
                if open_tag is not None and name == open_tag:
                    # Self-closing empty element
                    parts = [f"<{open_tag}"]
                    for k, v in attrs:
                        parts.append(f' {k}="{xml_escape(str(v))}"')
                    parts.append('/>')
                    out.append(''.join(parts))
                    open_tag = None
                    attrs = []
                else:
                    emit_open()
                    # Pop if matching
                    if stack and stack[-1] == name:
                        stack.pop()
                    out.append(f"</{name}>")
            elif t in (FT_String, FT_Data, FT_Raw):
                if t == FT_String:
                    _id = buf.read_u16le()
                    n = buf.read_i32le()
                    val = read_string(n)
                    key = name_ids.get(_id, f'id{_id}')
                    attrs.append((key, val))
                else:
                    n = buf.read_i32le()
                    val = read_string(n)
                    if t == FT_Raw:
                        # Ignore boilerplate like XML prolog/doctype to avoid multiple roots
                        continue
                    # FT_Data is element content
                    emit_open()
                    out.append(xml_escape(val))
            elif t in (FT_Float, FT_Double):
                _id = buf.read_u16le()
                if t == FT_Float:
                    val = struct.unpack('<f', buf.read(4))[0]
                    buf.read_i32le()  # digits (ignored)
                else:
                    val = struct.unpack('<d', buf.read(8))[0]
                    buf.read_i32le()
                key = name_ids.get(_id, f'id{_id}')
                attrs.append((key, str(val)))
            elif t in (FT_Int, FT_Long, FT_LongLong, FT_SizeT):
                _id = buf.read_u16le()
                if t in (FT_Int, FT_SizeT, FT_Long):
                    val = buf.read_i32le()
                else:
                    # long long
                    val = struct.unpack('<q', buf.read(8))[0]
                key = name_ids.get(_id, f'id{_id}')
                attrs.append((key, str(val)))
            elif t == FT_Bool:
                _id = buf.read_u16le()
                valb = buf.getc()
                key = name_ids.get(_id, f'id{_id}')
                attrs.append((key, '1' if valb else '0'))
            else:
                # Unknown token, bail
                break
    except EOFError:
        pass

    # Close any pending open tag as self-closing
    if open_tag is not None:
        parts = [f"<{open_tag}"]
        for k, v in attrs:
            parts.append(f' {k}="{xml_escape(str(v))}"')
        parts.append('/>')
        out.append(''.join(parts))
        open_tag = None
        attrs = []
    # Close any still-open stack (shouldn't happen if doc is well-formed)
    while stack:
        name = stack.pop()
        out.append(f"</{name}>")

    return ''.join(out)


def _read_sampleblock_from_db(conn: sqlite3.Connection, blockid: int) -> Tuple[str, List[float]]:
    # Returns (format, floats)
    cur = conn.cursor()
    cur.execute("SELECT sampleformat, samples FROM sampleblocks WHERE blockid = ?", (blockid,))
    row = cur.fetchone()
    if not row:
        return 'float32', []
    sf, blob = row
    fmt = 'float32'
    if sf == 0x00020001 or sf == 131073:
        fmt = 'int16'
    elif sf == 0x00040001 or sf == 262145:
        fmt = 'int24'
    elif sf == 0x0004000F or sf == 262159:
        fmt = 'float32'
    data = blob
    n = 0
    floats: List[float] = []
    if fmt == 'int16':
        n = len(data) // 2
        ints = struct.unpack('<' + 'h' * n, data[:2*n])
        floats = [max(-1.0, min(1.0, x / 32768.0)) for x in ints]
    elif fmt == 'int24':
        n = len(data) // 3
        floats = []
        mv = memoryview(data)
        for i in range(n):
            b0, b1, b2 = mv[i*3:(i+1)*3]
            val = b0 | (b1 << 8) | (b2 << 16)
            if val & 0x800000:
                val -= 0x1000000
            floats.append(max(-1.0, min(1.0, val / 8388608.0)))
    else:  # float32
        n = len(data) // 4
        floats = list(struct.unpack('<' + 'f' * n, data[:4*n]))
    return fmt, floats


def load_tracks_from_aup3(db_path: str, debug_chars: int = 0) -> Tuple[List[TrackData], float]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    # Prefer autosave if present
    rowid = None
    try:
        cur.execute('SELECT ROWID FROM autosave WHERE id = 1')
        r = cur.fetchone()
        if r:
            rowid = r[0]
            table = 'autosave'
    except Exception:
        rowid = None
    if rowid is None:
        cur.execute('SELECT ROWID FROM project WHERE id = 1')
        r = cur.fetchone()
        if not r:
            raise RuntimeError('No project record found in aup3')
        rowid = r[0]
        table = 'project'
    # Read blobs
    cur.execute(f'SELECT dict, doc FROM {table} WHERE ROWID = ?', (rowid,))
    d = cur.fetchone()
    if not d:
        raise RuntimeError('Failed to read project doc')
    dict_blob, doc_blob = d
    xml = _decode_project_binary_xml(dict_blob, doc_blob)
    if debug_chars and debug_chars > 0:
        dbg_path = os.path.join(os.path.dirname(db_path), 'aup2wav_debug.xml')
        try:
            with open(dbg_path, 'w', encoding='utf-8') as f:
                f.write(xml[:debug_chars])
            eprint(f"[debug] wrote first {debug_chars} chars to {dbg_path}")
        except Exception:
            pass
    # Parse XML similar to .aup
    root = ET.fromstring(xml)
    if 'project' not in root.tag:
        raise RuntimeError('AUP3 XML missing project root')
    project_rate = float(root.attrib.get('rate', '44100'))
    tracks: List[TrackData] = []

    def _iter_ns(elem, name):
        lname = name
        for e in elem.iter():
            if e.tag.split('}')[-1] == lname:
                yield e

    wt_count = 0
    for wt in _iter_ns(root, 'wavetrack'):
        wt_count += 1
        name = wt.attrib.get('name', 'Track')
        rate = float(wt.attrib.get('rate', project_rate))
        offset_sec = float(wt.attrib.get('offset', '0'))
        lval = wt.attrib.get('linked', '0')
        linked = (lval not in {'0', 'false', 'False'})
        channel = wt.attrib.get('channel', None)
        try:
            channel_int = int(channel) if channel is not None else None
        except ValueError:
            channel_int = None
        try:
            gain = float(wt.attrib.get('gain', '1'))
        except Exception:
            gain = 1.0
        try:
            pan = float(wt.attrib.get('pan', '0'))
        except Exception:
            pan = 0.0
        mute = wt.attrib.get('mute', '0') not in {'0', 'false', 'False'}
        solo = wt.attrib.get('solo', '0') not in {'0', 'false', 'False'}
        track = TrackData(name=name, rate=rate, offset_sec=offset_sec, linked=linked, channel=channel_int, gain=gain, pan=pan, mute=mute, solo=solo)

        for wc in _iter_ns(wt, 'waveclip'):
            clip_offset = float(wc.attrib.get('offset', '0'))
            seq = next(_iter_ns(wc, 'sequence'), None)
            if seq is None:
                continue
            # Envelope
            env_points: List[Tuple[float, float]] = []
            env = next(_iter_ns(wc, 'envelope'), None)
            if env is not None:
                for cp in env.findall('controlpoint'):
                    try:
                        t = float(cp.attrib.get('t'))
                        val = float(cp.attrib.get('val'))
                        env_points.append((t, val))
                    except Exception:
                        continue
            for wb in _iter_ns(seq, 'waveblock'):
                start = int(float(wb.attrib.get('start', '0')))
                # AUP3: waveblock has blockid attribute
                bid = wb.attrib.get('blockid')
                if bid is None:
                    continue
                bid_val = int(bid)
                if bid_val <= 0:
                    # silent block; length is -blockid
                    length = -bid_val
                    track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                    continue
                # fetch samples from DB
                _fmt, floats = _read_sampleblock_from_db(conn, bid_val)
                if env_points:
                    floats = apply_clip_envelope(floats, rate, clip_offset, env_points, start)
                track.add_segment(start + int(round(clip_offset * rate)), floats)
        tracks.append(track)

    if debug_chars and debug_chars > 0:
        eprint(f"[debug] wavetrack count: {wt_count}")
        try:
            cur.execute('SELECT COUNT(1) FROM sampleblocks')
            sbc = cur.fetchone()[0]
            eprint(f"[debug] sampleblocks rows: {sbc}")
        except Exception:
            pass

    conn.close()
    return tracks, project_rate


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def find_project_data_dir(aup_path: str, projname: Optional[str]) -> Optional[str]:
    base_dir = os.path.dirname(os.path.abspath(aup_path))
    candidates: List[str] = []
    if projname:
        candidates.append(os.path.join(base_dir, f"{projname}_data"))
    # Fallback: any "*_data" sibling containing typical blockfile dirs (e00, e01, ...)
    for name in os.listdir(base_dir):
        if name.endswith("_data"):
            candidates.append(os.path.join(base_dir, name))
    for c in candidates:
        if os.path.isdir(c):
            return c
    return None


def parse_sample_format(fmt_str: str) -> str:
    """Map AUP sequence@sampleformat to one of: 'int16', 'int24', 'float32'.

    The AUP DTD leaves sampleformat as CDATA. For historic Audacity, it may be:
      - the persisted enum values (see SampleFormat.h):
        int16Sample = 0x00020001 (131073), int24Sample = 0x00040001 (262145), floatSample = 0x0004000F (262159)
      - or in some older projects a width-like token such as '16', '24', '32'.
    """
    s = (fmt_str or '').strip()
    # Try integer parse and map known persisted values
    try:
        val = int(s)
        if val == 0x00020001 or val == 131073:
            return 'int16'
        if val == 0x00040001 or val == 262145:
            return 'int24'
        if val == 0x0004000F or val == 262159:
            return 'float32'
        # Fall through to width-based heuristic
    except ValueError:
        pass
    # Width-like values
    if s in {'16', 'int16'}:
        return 'int16'
    if s in {'24', 'int24'}:
        return 'int24'
    if s in {'32', 'float', 'float32'}:
        return 'float32'
    # Default conservatively to 16-bit
    return 'int16'


def read_au_as_floats(path: str, expected_len: int, samplefmt: str) -> List[float]:
    """Read a mono Sun/NeXT AU file and return a list of floats in [-1.0, 1.0].

    Uses sunau for header parsing; decodes PCM/float according to `samplefmt`.
    """
    floats: List[float] = []
    with sunau.open(path, 'rb') as f:
        n_channels = f.getnchannels()
        sampwidth = f.getsampwidth()  # bytes per sample
        n_frames = f.getnframes()
        # Some sanity checks (not fatal)
        if n_channels != 1:
            eprint(f"Warning: AU block {path} has {n_channels} channels; expected mono. Using first channel only.")
        raw = f.readframes(n_frames)

    # AU is big-endian encoded. Decode according to samplefmt
    if samplefmt == 'int16' and sampwidth == 2:
        # '>h' per sample
        floats = [max(-1.0, min(1.0, x / 32768.0)) for x in struct.unpack(f'>{n_frames}h', raw[: 2 * n_frames])]
    elif samplefmt == 'int24' and sampwidth == 3:
        # Read 3 bytes per sample, big-endian signed 24-bit
        floats = []
        mv = memoryview(raw)
        for i in range(n_frames):
            b0, b1, b2 = mv[i*3:(i+1)*3]
            val = (b0 << 16) | (b1 << 8) | b2
            if val & 0x800000:
                val -= 0x1000000
            floats.append(max(-1.0, min(1.0, val / 8388608.0)))
    elif samplefmt == 'float32' and sampwidth == 4:
        floats = [x for x in struct.unpack(f'>{n_frames}f', raw[: 4 * n_frames])]
    else:
        # Fallback: try to infer from width; assume linear PCM big-endian
        eprint(f"Warning: Unexpected sample format/width in {path} (fmt={samplefmt}, width={sampwidth}); attempting best-effort decode.")
        if sampwidth == 2:
            floats = [max(-1.0, min(1.0, x / 32768.0)) for x in struct.unpack(f'>{n_frames}h', raw[: 2 * n_frames])]
        elif sampwidth == 3:
            floats = []
            mv = memoryview(raw)
            for i in range(n_frames):
                b0, b1, b2 = mv[i*3:(i+1)*3]
                val = (b0 << 16) | (b1 << 8) | b2
                if val & 0x800000:
                    val -= 0x1000000
                floats.append(max(-1.0, min(1.0, val / 8388608.0)))
        elif sampwidth == 4:
            # Try float32 first, then int32
            try:
                floats = [x for x in struct.unpack(f'>{n_frames}f', raw[: 4 * n_frames])]
            except struct.error:
                ints = struct.unpack(f'>{n_frames}i', raw[: 4 * n_frames])
                floats = [max(-1.0, min(1.0, x / 2147483648.0)) for x in ints]
        else:
            raise RuntimeError(f"Unsupported AU sample width: {sampwidth} in {path}")

    if expected_len and len(floats) != expected_len:
        # Trim or pad to expected length from XML
        if len(floats) > expected_len:
            floats = floats[:expected_len]
        else:
            floats.extend([0.0] * (expected_len - len(floats)))
    return floats


class TrackData:
    def __init__(self, name: str, rate: float, offset_sec: float, linked: bool, channel: Optional[int], gain: float, pan: float, mute: bool, solo: bool):
        self.name = name
        self.rate = float(rate)
        self.offset_sec = float(offset_sec)
        self.linked = linked
        self.channel = channel
        self.gain = float(gain)
        self.pan = float(pan)  # -1..+1 expected
        self.mute = mute
        self.solo = solo
        # segments: list of (start_sample_absolute, samples_list)
        self.segments: List[Tuple[int, List[float]]] = []
        self.length_samples: int = 0

    def add_segment(self, start_sample: int, samples: List[float]):
        if not samples:
            return
        abs_start = int(round(self.offset_sec * self.rate)) + start_sample
        abs_end = abs_start + len(samples)
        self.segments.append((abs_start, samples))
        if abs_end > self.length_samples:
            self.length_samples = abs_end

    def render(self) -> array:
        buf = array('f', [0.0] * self.length_samples)
        for start, samples in self.segments:
            end = start + len(samples)
            if end > len(buf):
                buf.extend([0.0] * (end - len(buf)))
            for i, v in enumerate(samples):
                idx = start + i
                buf[idx] += v
        # Apply track gain (linear scalar)
        if self.gain != 1.0:
            for i in range(len(buf)):
                buf[i] *= self.gain
        return buf


def apply_clip_envelope(samples: List[float], rate: float, clip_offset_sec: float, env_points: List[Tuple[float, float]], block_start_sample: int) -> List[float]:
    """Apply linear envelope to a block of samples.
    env_points: list of (t_sec, val) relative to start of clip (waveclip@offset).
    block_start_sample: position of the block start (in samples) relative to clip start (i.e., sequence waveblock start + waveclip offset).
    """
    if not env_points:
        return samples
    # Sort points
    pts = sorted(env_points, key=lambda x: x[0])
    # Precompute per-sample multipliers using piecewise-linear interpolation
    out = [0.0] * len(samples)
    # Helper to get envelope value at time t
    def env_at(t: float) -> float:
        if t <= pts[0][0]:
            return pts[0][1]
        if t >= pts[-1][0]:
            return pts[-1][1]
        # find enclosing segment (linear search; ok for small point counts)
        for i in range(1, len(pts)):
            t0, v0 = pts[i-1]
            t1, v1 = pts[i]
            if t0 <= t <= t1:
                if t1 == t0:
                    return v1
                a = (t - t0) / (t1 - t0)
                return v0 * (1 - a) + v1 * a
        return 1.0
    # Apply
    for i, v in enumerate(samples):
        t = (block_start_sample + i) / rate  # seconds relative to clip start
        g = env_at(t)
        out[i] = v * g
    return out


def load_tracks_from_aup(aup_path: str) -> Tuple[List[TrackData], float, str]:
    tree = ET.parse(aup_path)
    root = tree.getroot()
    if root.tag != 'project':
        # Some AUP files use namespaced elements. Try stripping namespace.
        if 'project' not in root.tag:
            raise RuntimeError('Not an Audacity AUP project file.')

    projname = root.attrib.get('projname', '')
    project_rate = float(root.attrib.get('rate', '44100'))
    data_dir = find_project_data_dir(aup_path, projname)
    if not data_dir:
        raise RuntimeError('Could not locate project data folder ("*_data").')

    tracks: List[TrackData] = []

    def _iter_ns(elem, name):
        lname = name
        for e in elem.iter():
            if e.tag.split('}')[-1] == lname:
                yield e

    for wt in _iter_ns(root, 'wavetrack'):
        name = wt.attrib.get('name', 'Track')
        rate = float(wt.attrib.get('rate', project_rate))
        offset_sec = float(wt.attrib.get('offset', '0'))
        lval = wt.attrib.get('linked', '0')
        linked = (lval not in {'0', 'false', 'False'})
        channel = wt.attrib.get('channel', None)
        try:
            channel_int = int(channel) if channel is not None else None
        except ValueError:
            channel_int = None

        # Track gain (linear) and pan (-1..+1). Defaults: gain=1.0, pan=0.0
        try:
            gain = float(wt.attrib.get('gain', '1'))
        except Exception:
            gain = 1.0
        try:
            pan = float(wt.attrib.get('pan', '0'))
        except Exception:
            pan = 0.0
        mute = wt.attrib.get('mute', '0') not in {'0', 'false', 'False'}
        solo = wt.attrib.get('solo', '0') not in {'0', 'false', 'False'}

        track = TrackData(name=name, rate=rate, offset_sec=offset_sec, linked=linked, channel=channel_int, gain=gain, pan=pan, mute=mute, solo=solo)

        for wc in _iter_ns(wt, 'waveclip'):
            clip_offset = float(wc.attrib.get('offset', '0'))
            seq = next(_iter_ns(wc, 'sequence'), None)
            if seq is None:
                continue
            samplefmt = parse_sample_format(seq.attrib.get('sampleformat', ''))

            # Envelope points under this clip
            env_points: List[Tuple[float, float]] = []
            env = next(_iter_ns(wc, 'envelope'), None)
            if env is not None:
                for cp in env.findall('controlpoint'):
                    try:
                        t = float(cp.attrib.get('t'))
                        val = float(cp.attrib.get('val'))
                        env_points.append((t, val))
                    except Exception:
                        continue

            for wb in _iter_ns(seq, 'waveblock'):
                try:
                    start = int(float(wb.attrib.get('start', '0')))
                except Exception:
                    start = 0

                # simpleblockfile
                sbf = next(_iter_ns(wb, 'simpleblockfile'), None)
                if sbf is not None:
                    filename = sbf.attrib.get('filename')
                    try:
                        length = int(sbf.attrib.get('len', '0'))
                    except Exception:
                        length = 0
                    if not filename:
                        eprint('Warning: simpleblockfile without filename; inserting silence')
                        track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                        continue
                    block_path = os.path.join(data_dir, filename)
                    if not os.path.isfile(block_path):
                        eprint(f"Warning: missing block file {block_path}; inserting silence")
                        track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                        continue
                    floats = read_au_as_floats(block_path, length, samplefmt)
                    # Apply clip envelope if present; block start relative to clip start (samples): start
                    if env_points:
                        floats = apply_clip_envelope(floats, rate, clip_offset, env_points, start)
                    # Account for waveclip offset as additional start
                    track.add_segment(start + int(round(clip_offset * rate)), floats)
                    continue

                # silentblockfile
                sil = next(_iter_ns(wb, 'silentblockfile'), None)
                if sil is not None:
                    try:
                        length = int(sil.attrib.get('len', '0'))
                    except Exception:
                        length = 0
                    track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                    continue

                # pcmaliasblockfile (not implemented)
                alias = next(_iter_ns(wb, 'pcmaliasblockfile'), None)
                if alias is not None:
                    try:
                        length = int(alias.attrib.get('aliaslen', '0'))
                    except Exception:
                        length = 0
                    # Best-effort read from aliasfile if WAV/AIFF
                    aliasfile = alias.attrib.get('aliasfile')
                    aliasstart = int(float(alias.attrib.get('aliasstart', '0')))
                    aliaschannel = int(alias.attrib.get('aliaschannel', '0'))
                    added = False
                    if aliasfile:
                        aliaspath = aliasfile
                        if not os.path.isabs(aliaspath):
                            # Resolve relative to project directory
                            aliaspath = os.path.join(os.path.dirname(os.path.abspath(aup_path)), aliasfile)
                        try:
                            ext = os.path.splitext(aliaspath)[1].lower()
                            if ext in ['.wav'] and os.path.isfile(aliaspath):
                                with wave.open(aliaspath, 'rb') as wf:
                                    ch = wf.getnchannels()
                                    sr = wf.getframerate()
                                    # Read specified channel frames
                                    if aliasstart < 0:
                                        aliasstart = 0
                                    wf.setpos(min(aliasstart, wf.getnframes()))
                                    frames = wf.readframes(length)
                                    # Extract channel
                                    sampwidth = wf.getsampwidth()
                                    # PCM little-endian likely; treat accordingly
                                    if sampwidth == 2:
                                        ints = struct.unpack('<' + 'h' * (len(frames)//2), frames)
                                        # de-interleave
                                        chan = [ints[i*ch + min(aliaschannel, ch-1)] for i in range(len(ints)//ch)]
                                        floats = [max(-1.0, min(1.0, x/32768.0)) for x in chan]
                                    elif sampwidth == 3:
                                        # 24-bit little-endian
                                        chan = []
                                        frame_count = len(frames) // (sampwidth * ch)
                                        for i in range(frame_count):
                                            base = i * sampwidth * ch + aliaschannel * sampwidth
                                            b0, b1, b2 = frames[base:base+3]
                                            val = b0 | (b1 << 8) | (b2 << 16)
                                            if val & 0x800000:
                                                val -= 0x1000000
                                            chan.append(val / 8388608.0)
                                        floats = [max(-1.0, min(1.0, v)) for v in chan]
                                    elif sampwidth == 4:
                                        ints = struct.unpack('<' + 'i' * (len(frames)//4), frames)
                                        chan = [ints[i*ch + min(aliaschannel, ch-1)] for i in range(len(ints)//ch)]
                                        floats = [max(-1.0, min(1.0, x/2147483648.0)) for x in chan]
                                    else:
                                        floats = [0.0] * length
                                    # Resample alias segment to track rate if necessary
                                    if sr != int(rate):
                                        floats = resample_linear(floats, sr, int(rate))
                                    floats = floats[:length] + [0.0] * max(0, length - len(floats))
                                    if env_points:
                                        floats = apply_clip_envelope(floats, rate, clip_offset, env_points, start)
                                    track.add_segment(start + int(round(clip_offset * rate)), floats)
                                    added = True
                            elif ext in ['.aiff', '.aif'] and os.path.isfile(aliaspath):
                                with aifc.open(aliaspath, 'rb') as af:
                                    ch = af.getnchannels()
                                    sr = af.getframerate()
                                    if aliasstart < 0:
                                        aliasstart = 0
                                    af.setpos(min(aliasstart, af.getnframes()))
                                    frames = af.readframes(length)
                                    sampwidth = af.getsampwidth()
                                    # AIFF is big-endian PCM
                                    if sampwidth == 2:
                                        ints = struct.unpack('>' + 'h' * (len(frames)//2), frames)
                                        chan = [ints[i*ch + min(aliaschannel, ch-1)] for i in range(len(ints)//ch)]
                                        floats = [max(-1.0, min(1.0, x/32768.0)) for x in chan]
                                    elif sampwidth == 3:
                                        chan = []
                                        frame_count = len(frames) // (sampwidth * ch)
                                        for i in range(frame_count):
                                            base = i * sampwidth * ch + aliaschannel * sampwidth
                                            b0, b1, b2 = frames[base:base+3]
                                            val = (b0 << 16) | (b1 << 8) | b2
                                            if val & 0x800000:
                                                val -= 0x1000000
                                            chan.append(val / 8388608.0)
                                        floats = [max(-1.0, min(1.0, v)) for v in chan]
                                    elif sampwidth == 4:
                                        ints = struct.unpack('>' + 'i' * (len(frames)//4), frames)
                                        chan = [ints[i*ch + min(aliaschannel, ch-1)] for i in range(len(ints)//ch)]
                                        floats = [max(-1.0, min(1.0, x/2147483648.0)) for x in chan]
                                    else:
                                        floats = [0.0] * length
                                    if sr != int(rate):
                                        floats = resample_linear(floats, sr, int(rate))
                                    floats = floats[:length] + [0.0] * max(0, length - len(floats))
                                    if env_points:
                                        floats = apply_clip_envelope(floats, rate, clip_offset, env_points, start)
                                    track.add_segment(start + int(round(clip_offset * rate)), floats)
                                    added = True
                        except Exception:
                            added = False
                    if not added:
                        eprint('Warning: pcmaliasblockfile encountered; inserting silence')
                        track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                    continue

                # legacyblockfile (not implemented)
                leg = next(_iter_ns(wb, 'legacyblockfile'), None)
                if leg is not None:
                    try:
                        length = int(leg.attrib.get('len', '0'))
                    except Exception:
                        length = 0
                    eprint('Warning: legacyblockfile encountered; inserting silence')
                    track.add_segment(start + int(round(clip_offset * rate)), [0.0]*length)
                    continue

        tracks.append(track)

    # Use project rate if no tracks specify differently
    return tracks, project_rate, data_dir


def pair_stereo_tracks(tracks: List[TrackData]) -> Optional[List[Tuple[TrackData, TrackData]]]:
    pairs: List[Tuple[TrackData, TrackData]] = []
    i = 0
    while i < len(tracks) - 1:
        t1, t2 = tracks[i], tracks[i+1]
        if t1.linked or t2.linked:
            pairs.append((t1, t2))
            i += 2
        else:
            return None
    if i == len(tracks) - 1:
        return None
    return pairs


def resample_linear(samples: List[float], src_rate: int, dst_rate: int) -> List[float]:
    if src_rate == dst_rate or len(samples) == 0:
        return samples[:]
    ratio = dst_rate / float(src_rate)
    out_len = int(math.ceil(len(samples) * ratio))
    out = [0.0] * out_len
    for i in range(out_len):
        x = i / ratio
        j = int(math.floor(x))
        a = x - j
        if j >= len(samples) - 1:
            out[i] = samples[-1]
        else:
            out[i] = samples[j] * (1 - a) + samples[j+1] * a
    return out


def floats_to_int16_bytes(interleaved: List[float]) -> bytes:
    out = bytearray(len(interleaved) * 2)
    mv = memoryview(out)
    for i, v in enumerate(interleaved):
        x = max(-1.0, min(1.0, v))
        n = int(round(x * 32767.0))
        struct.pack_into('<h', mv, i*2, n)
    return bytes(out)


def write_wav(output_path: str, channels: List[array], rate: int, bitdepth: str = '16', dither: str = 'none'):
    if not channels:
        raise RuntimeError('No audio to write')
    nchan = len(channels)
    # Pad all channels to the same length
    max_len = max(len(ch) for ch in channels)
    for ch in channels:
        if len(ch) < max_len:
            ch.extend([0.0] * (max_len - len(ch)))
    # Interleave
    interleaved: List[float] = []
    for i in range(max_len):
        for ch in channels:
            interleaved.append(ch[i])
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(nchan)
        wf.setframerate(int(rate))
        if bitdepth == '16':
            wf.setsampwidth(2)
            # Apply TPDF dithering if requested
            if dither == 'tpdf':
                s = 32767.0
                interleaved = [max(-1.0, min(1.0, v + (random.random() - random.random())/s)) for v in interleaved]
            pcm = floats_to_int16_bytes(interleaved)
            wf.writeframes(pcm)
        elif bitdepth == '24':
            wf.setsampwidth(3)
            # 24-bit little-endian PCM
            out = bytearray(len(interleaved) * 3)
            mv = memoryview(out)
            for i, v in enumerate(interleaved):
                x = max(-1.0, min(1.0, v))
                if dither == 'tpdf':
                    x = max(-1.0, min(1.0, x + (random.random() - random.random())/8388607.0))
                n = int(round(x * 8388607.0))
                if n < 0:
                    n += 1 << 24
                # little-endian 24-bit
                mv[i*3 + 0] = n & 0xFF
                mv[i*3 + 1] = (n >> 8) & 0xFF
                mv[i*3 + 2] = (n >> 16) & 0xFF
            wf.writeframes(bytes(out))
        elif bitdepth == '32f':
            wf.setsampwidth(4)
            # Write as IEEE float little-endian
            out = bytearray(len(interleaved) * 4)
            mv = memoryview(out)
            for i, v in enumerate(interleaved):
                struct.pack_into('<f', mv, i*4, float(v))
            wf.writeframes(bytes(out))
        else:
            raise ValueError('Unsupported bitdepth; choose 16, 24, or 32f')


def mixdown_tracks(channels: List[array], mode: str) -> List[array]:
    # Compute mixed mono, then duplicate if stereo requested
    max_len = max(len(ch) for ch in channels) if channels else 0
    mix = array('f', [0.0] * max_len)
    for ch in channels:
        if len(ch) < max_len:
            ch = ch + array('f', [0.0] * (max_len - len(ch)))
        for i, v in enumerate(ch):
            mix[i] += v
    # Simple normalization: if peaks exceed 1.0, scale down
    peak = max((abs(v) for v in mix), default=0.0)
    if peak > 1.0 and peak > 0:
        scale = 1.0 / peak
        for i in range(len(mix)):
            mix[i] *= scale
    if mode == 'mono':
        return [mix]
    elif mode == 'stereo':
        return [mix, mix[:]]
    else:
        raise ValueError('mixdown mode must be mono or stereo')


def equal_power_pan_gains(pan: float) -> Tuple[float, float]:
    # pan in [-1..+1]; center uses -3 dB per channel
    p = max(-1.0, min(1.0, pan))
    angle = (p + 1.0) * (math.pi / 4.0)
    left = math.cos(angle)
    right = math.sin(angle)
    return left, right


def main():
    ap = argparse.ArgumentParser(description='Convert Audacity .aup (XML) project to .wav (mixdown like File->Export)')
    ap.add_argument('aup', help='Path to .aup project file')
    ap.add_argument('-o', '--out', help='Output WAV path (default: <aup_basename>.wav)')
    ap.add_argument('--mixdown', choices=['mono', 'stereo'], help='Force mixdown to mono or stereo (default: stereo)')
    ap.add_argument('--multichannel', action='store_true', help='Output each wavetrack as a separate channel instead of mixing')
    ap.add_argument('--bitdepth', choices=['16', '24', '32f'], default='16', help='Output bit depth (default: 16)')
    ap.add_argument('--dither', choices=['none', 'tpdf'], default='none', help='Dither type for 16/24-bit output (default: none)')
    ap.add_argument('--normalize', action='store_true', help='Normalize mix to full scale before bit depth conversion')
    ap.add_argument('--headroom-db', type=float, default=0.0, help='Headroom in dB to apply after normalization (default: 0)')
    ap.add_argument('--export-rate', type=int, help='Override export sample rate in Hz (default: project rate)')
    # Experimental .aup3 support via Audacity's scripting pipe
    ap.add_argument('--aup3-via-audacity', action='store_true', help='EXPERIMENTAL: For .aup3/.aup4, use a running Audacity with scripting enabled to export')
    ap.add_argument('--audacity-bin', help='Path to audacity binary (optional; used to auto-start Audacity for --aup3-via-audacity)')
    ap.add_argument('--debug-xml', type=int, default=0, help='Dump first N chars of reconstructed AUP3 XML to a file and print basic counts')
    # Stems export
    ap.add_argument('--stems', action='store_true', help='Export one WAV per wavetrack (stems) instead of a single mix')
    ap.add_argument('--stems-dir', help='Output directory for stems (default: alongside -o or input)')
    ap.add_argument('--stem-pattern', default='{base}__{i:02d}_{name}.wav', help='Stem filename pattern; supports {base}, {i}, {name}')
    ap.add_argument('--stems-apply-pan', action='store_true', help='Apply track pan to stereo stems (mono stems if not set)')
    # Track selection and inspection
    ap.add_argument('--only', help='Comma-separated list of track indices (1-based) or name substrings to include')
    ap.add_argument('--exclude', help='Comma-separated list of track indices (1-based) or name substrings to exclude')
    ap.add_argument('--print-metadata', action='store_true', help='Print project and track metadata, then exit')
    args = ap.parse_args()

    in_path = os.path.abspath(args.aup)
    if not os.path.isfile(in_path):
        eprint(f'Input not found: {in_path}')
        sys.exit(1)
    out_path = args.out or os.path.splitext(in_path)[0] + '.wav'

    # Detect .aup3/.aup4 (SQLite DB) and fail fast with a helpful message
    lower = in_path.lower()
    if lower.endswith('.aup3') or lower.endswith('.aup4'):
        # Try native sqlite path
        try:
            tracks, project_rate = load_tracks_from_aup3(in_path, args.debug_xml)
        except Exception as e:
            if args.aup3_via_audacity:
                if export_aup3_via_audacity(in_path, out_path, args):
                    print(f'Wrote: {out_path}')
                    return
                eprint('Failed to export via Audacity scripting. Ensure Audacity is installed, running, and scripting is enabled.')
                sys.exit(3)
            eprint(f'Failed to parse .aup3: {e}')
            eprint('If installed, you can try --aup3-via-audacity.')
            sys.exit(2)
        # proceed to render/export using common path below
        goto_render = True
    else:
        goto_render = False
    if not goto_render:
        try:
            with open(in_path, 'rb') as fh:
                head = fh.read(16)
                if head.startswith(b'SQLite format 3'):
                    try:
                        tracks, project_rate = load_tracks_from_aup3(in_path, args.debug_xml)
                        goto_render = True
                    except Exception as e:
                        eprint(f'Failed to parse .aup3: {e}')
                        sys.exit(2)
        except Exception:
            pass

    if not goto_render:
        try:
            tracks, project_rate, _ = load_tracks_from_aup(in_path)
        except Exception as e:
            eprint(f'Failed to parse project: {e}')
            eprint('Ensure the input is a legacy .aup (XML) file next to its _data folder, or an .aup3 file.')
            sys.exit(1)

    if not tracks:
        eprint('No wavetracks found.')
        sys.exit(1)

    # Choose export rate
    export_rate = int(args.export_rate) if args.export_rate else int(round(project_rate))

    # Track filtering helpers
    def parse_select_list(s: Optional[str]) -> List[str]:
        if not s:
            return []
        return [x.strip() for x in s.split(',') if x.strip()]

    def match_indices(all_tracks: List['TrackData'], tokens: List[str]) -> List[int]:
        idxs = set()
        names = [t.name.lower() for t in all_tracks]
        for tok in tokens:
            if tok.isdigit():
                i = int(tok) - 1
                if 0 <= i < len(all_tracks):
                    idxs.add(i)
            else:
                tkl = tok.lower()
                for i, nm in enumerate(names):
                    if tkl in nm:
                        idxs.add(i)
        return sorted(idxs)

    only_tokens = parse_select_list(args.only)
    exclude_tokens = parse_select_list(args.exclude)

    # Base selection by mute/solo
    soloed = [i for i, t in enumerate(tracks) if t.solo]
    base_idxs = soloed if soloed else [i for i, t in enumerate(tracks) if not t.mute]

    # Apply --only
    if only_tokens:
        only_idxs = match_indices(tracks, only_tokens)
        base_idxs = [i for i in base_idxs if i in set(only_idxs)]

    # Apply --exclude
    if exclude_tokens:
        excl_idxs = set(match_indices(tracks, exclude_tokens))
        base_idxs = [i for i in base_idxs if i not in excl_idxs]

    use_tracks = [tracks[i] for i in base_idxs]

    if args.print_metadata:
        # Print project and tracks info, then exit
        print(f'Project rate: {export_rate} Hz (project file rate may be {int(round(project_rate))} Hz)')
        print(f'Tracks total: {len(tracks)}; selected: {len(use_tracks)}')
        for i, t in enumerate(tracks, start=1):
            sel_marker = '*' if (i-1) in base_idxs else ' '
            length_sec = (t.length_samples / t.rate) if t.rate else 0.0
            print(f"{sel_marker}[{i}] name='{t.name}' rate={int(round(t.rate))}Hz linked={t.linked} mute={t.mute} solo={t.solo} pan={t.pan:.2f} gain={t.gain:.2f} offset={t.offset_sec:.3f}s segments={len(t.segments)} length={length_sec:.3f}s")
        return

    # Render tracks to float arrays and resample to export rate
    rendered = []
    for t in use_tracks:
        buf = t.render()
        if int(round(t.rate)) != int(round(export_rate)):
            buf = array('f', resample_linear(list(buf), int(round(t.rate)), int(round(export_rate))))
        rendered.append(buf)

    channels: List[array]

    # If stems requested, write one file per wavetrack and return
    if args.stems:
        base = os.path.splitext(os.path.basename(out_path if args.out else in_path))[0]
        stems_dir = args.stems_dir or os.path.dirname(out_path if args.out else in_path)
        os.makedirs(stems_dir, exist_ok=True)

        def sanitize(name: str) -> str:
            bad = '<>:"/\\|?*\n\r\t'
            return ''.join(c if c not in bad else '_' for c in name).strip() or 'Track'

        i = 0
        written = 0
        while i < len(use_tracks):
            t = use_tracks[i]
            name = sanitize(t.name)
            pattern = args.stem_pattern
            dest = pattern.format(base=base, i=i+1, name=name)
            dest_path = os.path.join(stems_dir, dest)

            buf = rendered[i]
            chans: List[array] = []
            if t.linked and i + 1 < len(use_tracks):
                # Stereo pair: use next track as right
                bufR = rendered[i+1]
                # Align lengths
                max_len = max(len(buf), len(bufR))
                if len(buf) < max_len:
                    buf.extend([0.0] * (max_len - len(buf)))
                if len(bufR) < max_len:
                    bufR.extend([0.0] * (max_len - len(bufR)))
                chans = [buf, bufR]
                i += 2
            else:
                if args.stems_apply_pan:
                    # Pan mono into stereo
                    l_gain, r_gain = equal_power_pan_gains(t.pan)
                    outL = array('f', [0.0] * len(buf))
                    outR = array('f', [0.0] * len(buf))
                    for j, v in enumerate(buf):
                        outL[j] = v * l_gain
                        outR[j] = v * r_gain
                    chans = [outL, outR]
                else:
                    chans = [buf]
                i += 1

            # Optional normalization per stem
            if args.normalize and chans:
                peak = max((max((abs(v) for v in ch), default=0.0) for ch in chans), default=0.0)
                if peak > 0:
                    target = 10 ** (-args.headroom_db / 20.0)
                    scale = min(1.0, target / peak)
                    if scale < 1.0:
                        for ch in chans:
                            for k in range(len(ch)):
                                ch[k] *= scale

            try:
                write_wav(dest_path, chans, export_rate, bitdepth=args.bitdepth, dither=args.dither)
                written += 1
                print(f'Wrote stem: {dest_path}')
            except Exception as e:
                eprint(f'Failed to write stem {dest_path}: {e}')

        print(f'Exported {written} stems to {stems_dir}')
        return

    # If multichannel requested, put one track per channel
    if args.multichannel:
        channels = rendered
    else:
        # Default: stereo export
        # Handle linked stereo: treat consecutive linked tracks as L/R; apply gain; ignore pan for these pairs
        outL = array('f', [0.0])
        outR = array('f', [0.0])
        i = 0
        while i < len(use_tracks):
            t = use_tracks[i]
            buf = rendered[i]
            # Ensure out buffers length
            def ensure(n):
                if n > len(outL):
                    add = n - len(outL)
                    outL.extend([0.0]*add)
                    outR.extend([0.0]*add)

            if t.linked and i+1 < len(use_tracks):
                # Stereo pair
                bufR = rendered[i+1]
                ensure(max(len(buf), len(bufR)))
                # Sum pair into L/R
                for j in range(len(buf)):
                    outL[j] += buf[j]
                for j in range(len(bufR)):
                    outR[j] += bufR[j]
                i += 2
                continue
            # Mono track: pan into stereo using equal-power pan
            l_gain, r_gain = equal_power_pan_gains(t.pan)
            ensure(len(buf))
            for j, v in enumerate(buf):
                outL[j] += v * l_gain
                outR[j] += v * r_gain
            i += 1
        channels = [outL, outR]

    # Optional normalization (common gain across all channels)
    if args.normalize and channels:
        peak = 0.0
        for ch in channels:
            if len(ch) == 0:
                continue
            p = max((abs(v) for v in ch), default=0.0)
            if p > peak:
                peak = p
        if peak > 0:
            target = 10 ** (-args.headroom_db / 20.0)
            scale = min(1.0, target / peak)
            if scale < 1.0:
                for ch in channels:
                    for i in range(len(ch)):
                        ch[i] *= scale

    try:
        write_wav(out_path, channels, export_rate, bitdepth=args.bitdepth, dither=args.dither)
    except Exception as e:
        eprint(f'Failed to write WAV: {e}')
        sys.exit(1)

    print(f'Wrote: {out_path}')


if __name__ == '__main__':
    main()
