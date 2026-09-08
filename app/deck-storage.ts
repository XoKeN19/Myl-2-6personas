export async function deckStorage(value?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('imperio-photo-decks', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        'library',
        value === undefined ? 'readonly' : 'readwrite',
      );
      const op =
        value === undefined
          ? tx.objectStore('library').get('decks')
          : tx.objectStore('library').put(value, 'decks');
      tx.oncomplete = () => {
        resolve(op.result);
        db.close();
      };
      tx.onerror = () => {
        reject(tx.error);
        db.close();
      };
    };
  });
}
