// @ts-check
/**
 * @typedef {{ filename?: string; contentType?: string }} FormDataBuilderOptions
 */

/**
 * @typedef {{ disposition: string; type: string; value: string | Blob }} FormDataBuilderPair
 */

const CRLF = '\r\n';

class FormDataBuilder {
  constructor() {
    this.boundary = `----WebKitFormBoundary${Math.random().toString(36).slice(2)}`;
    /**
     * @type {FormDataBuilderPair[]}
     */
    this.pairs = [];
  }

  /**
   * Append String or Blob to FormData
   * @param {string} name
   * @param {string | Blob | File} value
   * @param {FormDataBuilderOptions | string} [optionsOrFilename]
   */
  append(name, value, optionsOrFilename) {
    if (!name) {
      return;
    }
    const options = typeof optionsOrFilename === 'string' ? { filename: optionsOrFilename } : optionsOrFilename;
    // WebKit's behavior
    const type = Object.prototype.toString.call(value);
    const isBinary = type === '[object File]' || type === '[object Blob]';
    // WebKit's behavior
    const enc = (str) => str.replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22');
    /**
     * @type {FormDataBuilderPair}
     */
    const pair = {
      disposition: `form-data; name="${enc(name || '')}"`,
      type: options.contentType || (typeof value === 'object' && value.type) || 'application/octet-stream',
      value: isBinary ? value : String(value),
    };

    if (isBinary) {
      pair.disposition += `; filename="${enc(options.filename || value.name || 'blob')}"`;
    }

    this.pairs.push(pair);
  }

  getBlob() {
    const array = this.pairs.flatMap((pair) => [
      `--${this.boundary}${CRLF}Content-Disposition: ${pair.disposition}`,
      `${CRLF}Content-Type: ${pair.type}`,
      CRLF + CRLF,
      pair.value,
      CRLF,
    ]);

    array.push(`--${this.boundary}--${CRLF}`);
    return new Blob(array);
  }

  getHeaders() {
    return {
      'Content-Type': `multipart/form-data; boundary=${this.boundary}`,
    };
  }
}

export default FormDataBuilder;