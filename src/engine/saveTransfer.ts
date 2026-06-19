import { readSave, writeSave } from './save';
import { parseSave, serializeSave } from './saveModel';

/** Download the current save as a .json file. Returns false if there's no save. */
export function downloadSave(filename = 'sturdy-volley-save.json'): boolean {
  const data = readSave();
  if (!data) return false;
  const blob = new Blob([serializeSave(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
}

/** Open a file picker, validate the chosen save, and persist it. */
export function pickAndImportSave(): Promise<ImportResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ ok: false, error: 'No file selected.' });
        return;
      }
      file
        .text()
        .then((text) => {
          try {
            writeSave(parseSave(text));
            resolve({ ok: true });
          } catch (err) {
            resolve({ ok: false, error: err instanceof Error ? err.message : 'Invalid save file.' });
          }
        })
        .catch(() => resolve({ ok: false, error: 'Could not read file.' }));
    });
    input.click();
  });
}
