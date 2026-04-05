/**
 * @file lib/http.js
 * @description Low-level HTTPS helpers used by the auth and API modules.
 * These functions wrap Node's built-in `https` module with a Promise-based
 * interface and handle response buffering and error propagation.
 *
 * No business logic lives here — callers are responsible for interpreting
 * the parsed response bodies.
 */

import https from "node:https";

/**
 * Pauses async execution for a given number of milliseconds.
 * Used between paginated API requests to be a good API citizen.
 *
 * @param {number} ms - Duration to sleep in milliseconds
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends an HTTPS POST request with an `application/x-www-form-urlencoded`
 * body and resolves with the parsed JSON response.
 *
 * @param {string} url - Fully-qualified request URL
 * @param {Record<string, string>} params - Key/value pairs to URL-encode as the request body
 * @returns {Promise<object>} - Parsed JSON response body
 * @throws {Error} - If the HTTP status code is not in the 2xx range
 */
export function httpsPost(url, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(
            new Error(
              `POST ${url} failed with status ${res.statusCode}: ${data}`,
            ),
          );
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Sends an HTTPS GET request with the provided headers and resolves with
 * the parsed JSON response.
 *
 * @param {string} url - Fully-qualified request URL (including query string)
 * @param {Record<string, string>} headers - HTTP headers to attach to the request
 * @returns {Promise<object>} - Parsed JSON response body
 * @throws {Error} - If the HTTP status code is not in the 2xx range
 */
export function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(
            new Error(
              `GET ${url} failed with status ${res.statusCode}: ${data}`,
            ),
          );
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}
