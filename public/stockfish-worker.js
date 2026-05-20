// Stockfish Web Worker
// The stockfish-18-lite-single.js file is designed to run as a web worker directly.
// When loaded via importScripts in a worker context, it sets up its own onmessage handler
// and uses postMessage to communicate. We just need to import it.
importScripts('/stockfish/stockfish-18-lite-single.js')
