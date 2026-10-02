# PDF viewer v12

Uses PDF.js 3.11.174 classic UMD builds (`build/pdf.js` and `build/pdf.worker.js`).
The app loads both files via XHR, executes the classic library as ordinary JavaScript, and creates a classic Worker from a Blob URL. This avoids ES module MIME handling on Android/local WebViews.

Local CMaps and standard fonts are under `assets/pdfjs/web/`.
