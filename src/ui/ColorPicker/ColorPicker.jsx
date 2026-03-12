import { useRef, useEffect, useState, useCallback } from "react";
import "./ColorPicker.css";

// Colour math helpers

function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [
    Math.round(f(5) * 255),
    Math.round(f(3) * 255),
    Math.round(f(1) * 255),
  ];
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h =
    d === 0
      ? 0
      : max === r
        ? (((g - b) / d) % 6) * 60
        : max === g
          ? ((b - r) / d + 2) * 60
          : ((r - g) / d + 4) * 60;
  const s = max === 0 ? 0 : d / max;
  return [h < 0 ? h + 360 : h, s, max];
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length === 3)
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToHsv(hex) {
  return rgbToHsv(...hexToRgb(hex));
}

export function hsvToHex(h, s, v) {
  return rgbToHex(...hsvToRgb(h, s, v));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// SV gradient square

function SVPad({ hue, sv, onChange, onCommit }) {
  const canvasRef = useRef(null);
  const dragging = useRef(false);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const { width: w, height: h } = cvs;

    const baseColor = `hsl(${hue}, 100%, 50%)`;
    const satGrad = ctx.createLinearGradient(0, 0, w, 0);
    satGrad.addColorStop(0, "white");
    satGrad.addColorStop(1, baseColor);
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, w, h);

    const valGrad = ctx.createLinearGradient(0, 0, 0, h);
    valGrad.addColorStop(0, "transparent");
    valGrad.addColorStop(1, "black");
    ctx.fillStyle = valGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hue]);

  useEffect(() => {
    draw();
  }, [draw]);

  function getCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    return [s, v];
  }

  function pick(e) {
    onChange(getCoords(e));
  }

  return (
    <div className="cp-sv-wrap">
      <canvas
        ref={canvasRef}
        className="cp-sv"
        width={160}
        height={120}
        onMouseDown={(e) => {
          dragging.current = true;
          pick(e);
        }}
        onMouseMove={(e) => {
          if (dragging.current) pick(e);
        }}
        onMouseUp={(e) => {
          dragging.current = false;
          onCommit?.(getCoords(e));
        }}
        onMouseLeave={() => {
          dragging.current = false;
        }}
      />
      <div
        className="cp-sv-cursor"
        style={{
          left: `${sv[0] * 100}%`,
          top: `${(1 - sv[1]) * 100}%`,
        }}
      />
    </div>
  );
}

// Hue slider

function HueSlider({ hue, onChange, onCommit }) {
  const dragging = useRef(false);

  function getHue(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return clamp(((e.clientX - rect.left) / rect.width) * 360, 0, 360);
  }

  return (
    <div className="cp-hue-wrap">
      <div
        className="cp-hue"
        onMouseDown={(e) => {
          dragging.current = true;
          onChange(getHue(e));
        }}
        onMouseMove={(e) => {
          if (dragging.current) onChange(getHue(e));
        }}
        onMouseUp={(e) => {
          dragging.current = false;
          onCommit?.(getHue(e));
        }}
        onMouseLeave={() => {
          dragging.current = false;
        }}
      >
        <div
          className="cp-hue-cursor"
          style={{ left: `${(hue / 360) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Alpha slider

function AlphaSlider({ alpha, rgb, onChange, onCommit }) {
  const dragging = useRef(false);
  const [r, g, b] = rgb;

  function getAlpha(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return clamp((e.clientX - rect.left) / rect.width, 0, 1);
  }

  return (
    <div className="cp-alpha-wrap">
      <div
        className="cp-alpha"
        style={{ "--cp-color": `rgb(${r},${g},${b})` }}
        onMouseDown={(e) => {
          dragging.current = true;
          onChange(getAlpha(e));
        }}
        onMouseMove={(e) => {
          if (dragging.current) onChange(getAlpha(e));
        }}
        onMouseUp={(e) => {
          dragging.current = false;
          onCommit?.(getAlpha(e));
        }}
        onMouseLeave={() => {
          dragging.current = false;
        }}
      >
        <div className="cp-alpha-cursor" style={{ left: `${alpha * 100}%` }} />
      </div>
    </div>
  );
}

// Main ColorPicker

/**
 * props:
 *   hex      – "#rrggbb" string (alpha ignored in hex; use alpha prop)
 *   alpha    – 0–1 (default 1)
 *   onChange – (hex, alpha) => void — called on every drag movement (preview only)
 *   onCommit – (hex, alpha) => void — called once on mouseUp (commit to history)
 */
export function ColorPicker({ hex, alpha = 1, onChange, onCommit }) {
  const [h, s, v] = hexToHsv(hex || "#000000");
  const [hue, setHue] = useState(h);
  const [sv, setSv] = useState([s, v]);
  const [al, setAl] = useState(alpha);
  const [hexInput, setHexInput] = useState((hex || "#000000").replace("#", ""));
  const [rInput, setRInput] = useState(() =>
    hexToRgb(hex || "#000000")[0].toString(),
  );
  const [gInput, setGInput] = useState(() =>
    hexToRgb(hex || "#000000")[1].toString(),
  );
  const [bInput, setBInput] = useState(() =>
    hexToRgb(hex || "#000000")[2].toString(),
  );
  const lockRef = useRef(false);

  // Sync local state when hex prop changes externally
  useEffect(() => {
    if (lockRef.current) return;
    const [nh, ns, nv] = hexToHsv(hex || "#000000");
    setHue(nh);
    setSv([ns, nv]);
    setAl(alpha);
    const clean = (hex || "#000000").replace("#", "");
    setHexInput(clean);
    const [r, g, b] = hexToRgb(hex || "#000000");
    setRInput(r.toString());
    setGInput(g.toString());
    setBInput(b.toString());
  }, [hex, alpha]);

  function emit(nh, ns, nv, na) {
    lockRef.current = true;
    const newHex = hsvToHex(nh, ns, nv);
    onChange(newHex, na);
    setHexInput(newHex.replace("#", ""));
    const [r, g, b] = hexToRgb(newHex);
    setRInput(r.toString());
    setGInput(g.toString());
    setBInput(b.toString());
    requestAnimationFrame(() => {
      lockRef.current = false;
    });
  }

  function onHueChange(nh) {
    setHue(nh);
    emit(nh, sv[0], sv[1], al);
  }

  function onSvChange([ns, nv]) {
    setSv([ns, nv]);
    emit(hue, ns, nv, al);
  }

  function onAlphaChange(na) {
    setAl(na);
    emit(hue, sv[0], sv[1], na);
  }

  // Called by sub-components on mouseUp with their final committed value.
  // The other two HSV variables are currently settled in state (they weren't
  // changed by this drag) so the closure captures the correct values.
  function commitSv([ns, nv]) {
    onCommit?.(hsvToHex(hue, ns, nv), al);
  }
  function commitHue(nh) {
    onCommit?.(hsvToHex(nh, sv[0], sv[1]), al);
  }
  function commitAlpha(na) {
    onCommit?.(hsvToHex(hue, sv[0], sv[1]), na);
  }

  function onHexInput(raw) {
    setHexInput(raw);
    const clean = raw.replace(/[^0-9a-f]/gi, "");
    if (clean.length === 6) {
      const fullHex = "#" + clean;
      const [nh, ns, nv] = hexToHsv(fullHex);
      setHue(nh);
      setSv([ns, nv]);
      onChange(fullHex, al);
      onCommit?.(fullHex, al);
      const [r, g, b] = hexToRgb(fullHex);
      setRInput(r.toString());
      setGInput(g.toString());
      setBInput(b.toString());
    }
  }

  function onRgbInput(which, val) {
    if (which === "r") setRInput(val);
    if (which === "g") setGInput(val);
    if (which === "b") setBInput(val);
    const r = which === "r" ? parseInt(val) : parseInt(rInput);
    const g = which === "g" ? parseInt(val) : parseInt(gInput);
    const b = which === "b" ? parseInt(val) : parseInt(bInput);
    if ([r, g, b].every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
      const fullHex = rgbToHex(r, g, b);
      const [nh, ns, nv] = hexToHsv(fullHex);
      setHue(nh);
      setSv([ns, nv]);
      onChange(fullHex, al);
      onCommit?.(fullHex, al);
      setHexInput(fullHex.replace("#", ""));
    }
  }

  const rgb = hsvToRgb(hue, sv[0], sv[1]);

  return (
    <div className="cp">
      <SVPad hue={hue} sv={sv} onChange={onSvChange} onCommit={commitSv} />
      <HueSlider hue={hue} onChange={onHueChange} onCommit={commitHue} />
      <AlphaSlider
        alpha={al}
        rgb={rgb}
        onChange={onAlphaChange}
        onCommit={commitAlpha}
      />

      <div className="cp-preview-row">
        <div
          className="cp-preview-swatch"
          style={{ background: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${al})` }}
        />
        <div className="cp-inputs">
          <label className="cp-input-group">
            <span>Hex</span>
            <input
              className="cp-input cp-input--hex"
              value={hexInput}
              maxLength={6}
              onChange={(e) => onHexInput(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="cp-input-group">
            <span>R</span>
            <input
              className="cp-input cp-input--num"
              value={rInput}
              maxLength={3}
              onChange={(e) => onRgbInput("r", e.target.value)}
            />
          </label>
          <label className="cp-input-group">
            <span>G</span>
            <input
              className="cp-input cp-input--num"
              value={gInput}
              maxLength={3}
              onChange={(e) => onRgbInput("g", e.target.value)}
            />
          </label>
          <label className="cp-input-group">
            <span>B</span>
            <input
              className="cp-input cp-input--num"
              value={bInput}
              maxLength={3}
              onChange={(e) => onRgbInput("b", e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
