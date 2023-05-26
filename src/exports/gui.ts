// This is a hack to force extensions to use the gui module shipped in the app
// bundle.
import gui from 'gui';
module.exports = gui;
