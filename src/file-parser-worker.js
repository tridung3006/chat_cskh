import { parentPort, workerData } from 'node:worker_threads';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

try {
  const buffer = Buffer.from(workerData.data);
  const text = workerData.ext === '.pdf'
    ? (await pdfParse(buffer, { max: 200 })).text
    : (await mammoth.extractRawText({ buffer })).value;
  parentPort.postMessage({ text: String(text || '').slice(0, 250_000) });
} catch {
  parentPort.postMessage({ error: 'File parser rejected the document' });
}
