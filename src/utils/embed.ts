/**
 * Smart URL and embed code parser for interactive educational content
 */

export interface EmbedValidationResult {
  isValid: boolean;
  type: 'iframe' | 'html' | 'url' | 'youtube' | 'invalid';
  srcDoc?: string;
  srcUrl?: string;
  errorMessage?: string;
}

export function parseYouTubeUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Match youtube formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = trimmed.match(regExp);

  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0&modestbranding=1`;
  }

  return null;
}

export function validateAndFormatEmbed(input: string): EmbedValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      type: 'invalid',
      errorMessage: 'Vui lòng dán mã nhúng iframe, mã HTML trò chơi hoặc đường dẫn URL.',
    };
  }

  const raw = input.trim();

  // Check if it's a direct YouTube URL
  const youtubeEmbed = parseYouTubeUrl(raw);
  if (youtubeEmbed) {
    return {
      isValid: true,
      type: 'youtube',
      srcUrl: youtubeEmbed,
    };
  }

  // Check if it's an iframe tag
  const iframeMatch = raw.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  if (iframeMatch) {
    // Has a valid src
    return {
      isValid: true,
      type: 'iframe',
      srcDoc: raw,
      srcUrl: iframeMatch[1],
    };
  }

  // Check if it's general HTML (e.g., game written in HTML/CSS/JS exported by Gemini or AI Studio)
  if (
    raw.includes('<html') ||
    raw.includes('<div') ||
    raw.includes('<canvas') ||
    raw.includes('<script') ||
    raw.includes('<style') ||
    raw.includes('<!DOCTYPE')
  ) {
    // Complete or partial HTML game
    return {
      isValid: true,
      type: 'html',
      srcDoc: raw,
    };
  }

  // Check if it's a valid http/https URL
  try {
    const urlObj = new URL(raw);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return {
        isValid: true,
        type: 'url',
        srcUrl: raw,
      };
    }
  } catch {
    // not a pure URL
  }

  return {
    isValid: false,
    type: 'invalid',
    errorMessage: 'Mã nhúng không đúng định dạng. Bạn có thể dán mã thẻ <iframe>, toàn bộ mã HTML trò chơi hoặc liên kết URL hợp lệ.',
  };
}

export interface TeacherStorageBridgeConfig {
  teacherId: string;
  itemId: string;
  initialData?: Record<string, string>;
  readOnly?: boolean;
}

function buildStorageBridgeScript(config: TeacherStorageBridgeConfig): string {
  const safeJson = JSON.stringify(config.initialData || {}).replace(/</g, '\\u003c');
  const safeTeacherId = JSON.stringify(config.teacherId).replace(/</g, '\\u003c');
  const safeItemId = JSON.stringify(config.itemId).replace(/</g, '\\u003c');
  const readOnlyFlag = config.readOnly ? 'true' : 'false';

  return `<script>
(function() {
  var __teacherId = ${safeTeacherId};
  var __itemId = ${safeItemId};
  var __readOnly = ${readOnlyFlag};
  var __mem = Object.assign({}, ${safeJson});
  var __localRef = null;
  try { __localRef = window.localStorage; } catch (e) {}

  var proto = window.Storage && window.Storage.prototype;
  if (proto) {
    var origGet = proto.getItem;
    var origSet = proto.setItem;
    var origRemove = proto.removeItem;
    var origClear = proto.clear;
    var origKey = proto.key;
    var origLenDesc = Object.getOwnPropertyDescriptor(proto, 'length');

    proto.getItem = function(k) {
      if (__localRef && this === __localRef) {
        var keyStr = String(k);
        return Object.prototype.hasOwnProperty.call(__mem, keyStr) ? __mem[keyStr] : null;
      }
      return origGet.call(this, k);
    };

    proto.setItem = function(k, v) {
      if (__localRef && this === __localRef) {
        var keyStr = String(k);
        var valStr = String(v);
        __mem[keyStr] = valStr;
        if (!__readOnly && window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'TEACHER_APP_STORAGE_MUTATION',
            teacherId: __teacherId,
            itemId: __itemId,
            op: 'set',
            key: keyStr,
            value: valStr
          }, '*');
        }
        return;
      }
      return origSet.call(this, k, v);
    };

    proto.removeItem = function(k) {
      if (__localRef && this === __localRef) {
        var keyStr = String(k);
        delete __mem[keyStr];
        if (!__readOnly && window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'TEACHER_APP_STORAGE_MUTATION',
            teacherId: __teacherId,
            itemId: __itemId,
            op: 'remove',
            key: keyStr
          }, '*');
        }
        return;
      }
      return origRemove.call(this, k);
    };

    proto.clear = function() {
      if (__localRef && this === __localRef) {
        var keys = Object.keys(__mem);
        for (var i = 0; i < keys.length; i++) delete __mem[keys[i]];
        if (!__readOnly && window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'TEACHER_APP_STORAGE_MUTATION',
            teacherId: __teacherId,
            itemId: __itemId,
            op: 'clear'
          }, '*');
        }
        return;
      }
      return origClear.call(this);
    };

    proto.key = function(idx) {
      if (__localRef && this === __localRef) {
        var keys = Object.keys(__mem);
        return keys[idx] !== undefined ? keys[idx] : null;
      }
      return origKey.call(this, idx);
    };

    try {
      Object.defineProperty(proto, 'length', {
        configurable: true,
        get: function() {
          if (__localRef && this === __localRef) {
            return Object.keys(__mem).length;
          }
          return origLenDesc && origLenDesc.get ? origLenDesc.get.call(this) : 0;
        }
      });
    } catch (e) {}
  }

  window.addEventListener('message', function(ev) {
    if (!ev.data || ev.data.type !== 'TEACHER_APP_STORAGE_EXTERNAL_SYNC') return;
    if (ev.data.itemId !== __itemId || ev.data.teacherId !== __teacherId) return;
    var nextData = ev.data.data || {};
    var oldKeys = Object.keys(__mem);
    for (var i = 0; i < oldKeys.length; i++) delete __mem[oldKeys[i]];
    Object.assign(__mem, nextData);
    try {
      window.dispatchEvent(new CustomEvent('teacher-storage-sync', { detail: nextData }));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  });
})();
<\/script>`;
}

function injectScriptIntoHtml(html: string, scriptTag: string): string {
  if (!scriptTag) return html;
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const insertPos = headMatch.index + headMatch[0].length;
    return html.slice(0, insertPos) + '\n' + scriptTag + '\n' + html.slice(insertPos);
  }
  const htmlMatch = html.match(/<html\b[^>]*>/i);
  if (htmlMatch && htmlMatch.index !== undefined) {
    const insertPos = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, insertPos) + '\n<head>' + scriptTag + '</head>\n' + html.slice(insertPos);
  }
  return scriptTag + '\n' + html;
}

/**
 * Wraps raw HTML or embed code into a self-contained responsive sandbox document
 */
export function generateSandboxHtml(code: string, storageBridge?: TeacherStorageBridgeConfig): string {
  const trimmed = code.trim();
  const bridgeScript = storageBridge ? buildStorageBridgeScript(storageBridge) : '';

  // If it's already a full HTML document, inject bridge script into <head> and return
  if (trimmed.toLowerCase().includes('<!doctype') || trimmed.toLowerCase().includes('<html')) {
    return bridgeScript ? injectScriptIntoHtml(trimmed, bridgeScript) : trimmed;
  }

  const wrapIframe = (iframeHtml: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; }
    iframe { width: 100% !important; height: 100% !important; border: none !important; }
  </style>
</head>
<body>
  ${iframeHtml}
</body>
</html>`;

  // Check if it's a YouTube URL
  const youtubeEmbed = parseYouTubeUrl(trimmed);
  if (youtubeEmbed) {
    return wrapIframe(
      `<iframe src="${youtubeEmbed}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
    );
  }

  // If it's an iframe, center it and ensure responsive 100% width and height
  if (trimmed.toLowerCase().includes('<iframe')) {
    return wrapIframe(trimmed);
  }

  // Check if it's a direct http/https URL
  try {
    const urlObj = new URL(trimmed);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      const safeSrc = trimmed.replace(/"/g, '&quot;');
      return wrapIframe(
        `<iframe src="${safeSrc}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; xr-spatial-tracking" allowfullscreen></iframe>`
      );
    }
  } catch {
    // not a pure URL
  }

  // Otherwise, wrap in standard container with storage bridge
  return `<!DOCTYPE html>
<html>
<head>
  ${bridgeScript}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: system-ui, -apple-system, sans-serif; background: #ffffff; }
  </style>
</head>
<body>
  ${trimmed}
</body>
</html>`;
}
