self.importScripts('../vendor/pyodide.min.js');
self.importScripts('../helpers.js')
self.importScripts('base-api.js')

class API extends BaseAPI {
  pyodide = null;

  constructor(options) {
    super(options);
    this.runButtonCommandCallback = options.runButtonCommandCallback;

    this.initPyodide();
  }

  /**
   * Initialise pyodide and load custom python modules.
   */
  initPyodide() {
    loadPyodide({ indexURL: '../../wasm/py/' }).then(async (pyodide) => {
      this.pyodide = pyodide;

      // Import some basic modules.
      this.pyodide.runPython('import io, sys');

      // Get pyodide's Python version.
      const pyVersion = this.pyodide.runPython("sys.version.split(' ')[0]");
      const [pyMajorVersion, pyMinorVersion, _] = pyVersion.split('.');
      console.log(`Started Python v${pyVersion}`);

      // Load custom libraries and extract them in the virtual filesystem.
      let zipResponse = await fetch('../../wasm/py/custom_stdlib.zip');
      let zipBinary = await zipResponse.arrayBuffer();
      this.pyodide.unpackArchive(zipBinary, 'zip', {
        extractDir: `/lib/python${pyMajorVersion}.${pyMinorVersion}/site-packages/`
      });

      this.readyCallback();
    });
  }

  /**
   * Writes a list of files to pyodide's virtual filesystem.
   *
   * @param {array} files - The files to write to the filesystem.
   */
  writeFilesToVirtualFS(files) {
    for (const file of files) {
      // Put each file in the virtual file system.
      this.pyodide.FS.writeFile(file.filename, file.contents, { encoding: 'utf8' });

      // Because pyodide always runs the same session, we have to remove the
      // file as a module from sys.modules to make sure the command runs on
      // a clean state.
      const module = file.filename.replace('.py', '');
      this.pyodide.runPython(`sys.modules.pop('${module}', None)`);
    }
  }

  /**
   * Run the user's code and print the output to the terminal.
   *
   * @param {object} data - The data object coming from the worker.
   * @param {string} data.activeTabName - The name of the active editor tab.
   * @param {array} data.files - List of objects, each containing the filename
   * and contents of the corresponding editor tab.
   */
  runUserCode({ activeTabName, files }) {
    try {
      this.writeFilesToVirtualFS(files);

      const activeTab = files.find(file => file.filename === activeTabName);

      this.hostWriteCmd(`python3 ${activeTab.filename}`);
      this.hostWrite(this.run(activeTab.contents));
    } finally {
      if (typeof this.runUserCodeCallback === 'function') {
        this.runUserCodeCallback();
      }
    }
  }

  /**
   * Run a given command with the given files.
   *
  * @param {object} data - The data object coming from the worker.
   * @param {string} data.selector - Contains the button selector, which is
   * solely needed for the callback to enable the button after the code ran.
   * @param {string} activeTabName - The name of the active editor tab.
   * @param {array} data.cmd - A list of python commands to execute.
   * @param {array} data.files - List of objects, each containing the filename
   * and contents of the corresponding editor tab.
   */
  runButtonCommand({ selector, activeTabName, cmd, files }) {
    try {
      this.writeFilesToVirtualFS(files);

      // Replace <filename> placeholder with the active editor tab name.
      const moduleName = activeTabName.replace('.py', '');
      cmd = cmd.map((line) => line.replace('<filename>', moduleName));

      // Run the command and gather its results.
      const results = this.run(cmd);
      console.log('results', typeof results, results);

      // Print the reults to the terminal in the UI.
      this.hostWrite(results);
    } finally {
      this.runButtonCommandCallback(selector);
    }
  }

  /**
   * Run a string or an array of python code.
   *
   * @example run("print('Hello World!')"
   * @example run(["print('Hello World!')", "print('Hello World 2!')"]
   *
   * @param {string} code - The python code to run.
   * @returns {string} The output of the python code.
   */
  run(code) {
    if (!Array.isArray(code)) {
      code = code.split('\n')
    }

    // Clear the standard output.
    this.pyodide.runPython('sys.stdout = io.StringIO()')

    try {
      // Run the code and get the standard output.
      let cmdOutput = this.pyodide.runPython(code.join('\n'))
      const stdout = this.pyodide.runPython('sys.stdout.getvalue()')

      // In most cases, the commands will write to the stdout, but some packages,
      // such as mypy, will use io.StringIO() as well and return the value rather
      // than writing to the stdout, which leads to an empty stdout string. In
      // that case, we return the cmdOutput.

      if (stdout) return stdout;

      cmdOutput = [1,2,3];

      // If the cmdOutput is an object, we log an error to the console.
      if (isObject(cmdOutput) || isArray(cmdOutput)) {
        console.error([
          `Command output is an object instead of a string`,
          ...code,
          `Output: ${cmdOutput}`,
        ].join('\n'))
      }

      return cmdOutput;
    } catch (err) {
      return err.message;
    }
  }
}

// =============================================================================
// Worker message handling.
// =============================================================================

let api;
let port;

const onAnyMessage = async event => {
  switch (event.data.id) {
    case 'constructor':
      port = event.data.data;
      port.onmessage = onAnyMessage;
      api = new API({
        hostWrite(s) {
          port.postMessage({ id: 'write', data: s });
        },

        readyCallback() {
          port.postMessage({ id: 'ready' });
        },

        runUserCodeCallback() {
          port.postMessage({ id: 'runUserCodeCallback' });
        },

        runButtonCommandCallback(selector) {
          port.postMessage({ id: 'runButtonCommandCallback', selector });
        }
      });
      break;

    case 'runButtonCommand':
      api.runButtonCommand(event.data.data);
      break;

    case 'runUserCode':
      api.runUserCode(event.data.data);
      break;
  }
};

self.onmessage = onAnyMessage;
