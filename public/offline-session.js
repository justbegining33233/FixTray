/* Remembers who is signed in so the service worker can pick that role's cache.
   The worker cannot read localStorage. The page writes this database. */
(function (root) {
  var DB_NAME = 'fixtray-role-session';
  var DB_VERSION = 1;
  var EMPTY = { role: '', userId: '' };

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('session')) db.createObjectStore('session');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function finish(db, tx, result) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { db.close(); resolve(result); };
      tx.onerror = function () { db.close(); reject(tx.error); };
      tx.onabort = function () { db.close(); reject(tx.error || new Error('aborted')); };
    });
  }

  function readSession() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('session', 'readonly');
        var req = tx.objectStore('session').get('session');
        req.onsuccess = function () {
          var value = req.result || EMPTY;
          db.close();
          resolve({
            role: String(value.role || ''),
            userId: String(value.userId || ''),
          });
        };
        req.onerror = function () {
          db.close();
          reject(req.error);
        };
      });
    }).catch(function () { return EMPTY; });
  }

  function writeSession(role, userId) {
    var next = {
      role: String(role || '').trim().toLowerCase(),
      userId: String(userId || ''),
    };
    return openDb().then(function (db) {
      var tx = db.transaction('session', 'readwrite');
      tx.objectStore('session').put(next, 'session');
      return finish(db, tx, next);
    }).catch(function () { return next; });
  }

  root.FixTrayOfflineSession = {
    readSession: readSession,
    writeSession: writeSession,
  };
})(typeof self !== 'undefined' ? self : globalThis);
